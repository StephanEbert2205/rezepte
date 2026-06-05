<?php
declare(strict_types=1);

/**
 * Verknüpfte Konten + Einladungen.
 *
 * Workflow:
 *   A) Ziel-E-Mail gehört zu einem vorhandenen Nutzer
 *      → pending account_link anlegen; Empfänger muss manuell bestätigen
 *
 *   B) Ziel-E-Mail ist unbekannt
 *      → account_invitation anlegen (48 h gültig) + Einladungs-E-Mail
 *      → Empfänger klickt Link, meldet sich via Google an
 *      → processInvitation() legt pending account_link an
 *      → Empfänger sieht Anfrage in seinem Profil und bestätigt sie
 */
final class Accounts
{
    private const INVITE_TTL_HOURS = 48;

    // ── Verknüpfung anfragen / Einladung senden ──────────────────────────────

    /**
     * Verknüpfungsanfrage senden oder – bei unbekannter E-Mail – Einladung verschicken.
     *
     * Gibt bei vorhandenem Nutzer ein AccountLink-Array zurück (type='link'),
     * bei Einladung ein Invitation-Array (type='invitation').
     *
     * @throws RuntimeException  Bei Selbst-Verknüpfung, bereits vorhandener Verbindung usw.
     */
    public static function requestLink(int $requesterId, string $email, array $cfg): array
    {
        // Bereinigung abgelaufener Einladungen bei jeder Anfrage
        self::pruneExpiredInvitations();

        $target = Db::one(
            "SELECT `id`, `name`, `email`, `picture` FROM `users` WHERE `email` = ?",
            [$email]
        );

        // ── Fall A: Nutzer existiert bereits ────────────────────────────────
        if ($target !== null) {
            $targetId = (int) $target['id'];
            if ($targetId === $requesterId) {
                throw new RuntimeException('Du kannst dein Konto nicht mit dir selbst verknüpfen');
            }

            // Bestehende Verknüpfung/Anfrage in einer Richtung?
            $existing = Db::one(
                "SELECT `id`, `status` FROM `account_links`
                 WHERE (`requesterId` = ? AND `accepterId` = ?)
                    OR (`requesterId` = ? AND `accepterId` = ?)",
                [$requesterId, $targetId, $targetId, $requesterId]
            );
            if ($existing !== null) {
                $msg = $existing['status'] === 'accepted'
                    ? 'Konten sind bereits verknüpft'
                    : 'Anfrage wurde bereits gesendet';
                throw new RuntimeException($msg);
            }

            $now = gmdate('Y-m-d H:i:s');
            Db::run(
                "INSERT INTO `account_links` (`requesterId`, `accepterId`, `status`, `createdAt`)
                 VALUES (?, ?, 'pending', ?)",
                [$requesterId, $targetId, $now]
            );

            return [
                'type'       => 'link',
                'id'         => Db::lastId(),
                'status'     => 'pending',
                'direction'  => 'outgoing',
                'linkedUser' => [
                    'id'      => $targetId,
                    'name'    => $target['name'],
                    'email'   => $target['email'],
                    'picture' => $target['picture'],
                ],
                'createdAt'  => $now,
            ];
        }

        // ── Fall B: Nutzer existiert nicht → Einladung ───────────────────────
        // Doppelt-Einladung prüfen
        $existingInv = Db::one(
            "SELECT `id` FROM `account_invitations`
             WHERE `inviterId` = ? AND `email` = ?",
            [$requesterId, $email]
        );
        if ($existingInv !== null) {
            throw new RuntimeException('An diese E-Mail wurde bereits eine Einladung gesendet');
        }

        $token     = bin2hex(random_bytes(32));
        $now       = gmdate('Y-m-d H:i:s');
        $expiresAt = gmdate('Y-m-d H:i:s', time() + self::INVITE_TTL_HOURS * 3600);

        Db::run(
            "INSERT INTO `account_invitations`
                (`inviterId`, `email`, `token`, `expiresAt`, `createdAt`)
             VALUES (?, ?, ?, ?, ?)",
            [$requesterId, $email, $token, $expiresAt, $now]
        );
        $invId = Db::lastId();

        // Einladenden Nutzer für die E-Mail laden
        $requester = Db::one(
            "SELECT `name` FROM `users` WHERE `id` = ?",
            [$requesterId]
        );
        $inviterName = $requester['name'] ?? 'Ein Nutzer';

        Mailer::sendInvitation(
            $email,
            $inviterName,
            $token,
            $cfg['frontendUrl'],
            $cfg['mailFrom']
        );

        return [
            'type'      => 'invitation',
            'id'        => $invId,
            'email'     => $email,
            'expiresAt' => $expiresAt,
            'createdAt' => $now,
        ];
    }

    // ── Einladung annehmen (nach OAuth) ─────────────────────────────────────

    /**
     * Wird nach erfolgreichem Login des Eingeladenen aufgerufen.
     * Legt einen pending account_link an und löscht die Einladung.
     *
     * @return array  Der neu erzeugte account_link (direction='incoming' aus Sicht des Eingeladenen)
     * @throws RuntimeException  Bei abgelaufenem/ungültigem Token, Selbst-Verknüpfung usw.
     */
    public static function processInvitation(string $token, int $acceptorId): array
    {
        self::pruneExpiredInvitations();

        $inv = Db::one(
            "SELECT * FROM `account_invitations` WHERE `token` = ?",
            [$token]
        );
        if ($inv === null) {
            throw new RuntimeException('Einladung nicht gefunden oder abgelaufen');
        }

        $inviterId = (int) $inv['inviterId'];
        if ($inviterId === $acceptorId) {
            throw new RuntimeException('Du kannst deine eigene Einladung nicht annehmen');
        }

        // Existiert bereits eine Verknüpfung?
        $existing = Db::one(
            "SELECT `id`, `status` FROM `account_links`
             WHERE (`requesterId` = ? AND `accepterId` = ?)
                OR (`requesterId` = ? AND `accepterId` = ?)",
            [$inviterId, $acceptorId, $acceptorId, $inviterId]
        );

        // Einladung immer löschen (egal was danach passiert)
        Db::run("DELETE FROM `account_invitations` WHERE `token` = ?", [$token]);

        if ($existing !== null) {
            // Verknüpfung/Anfrage existiert bereits – einfach melden
            throw new RuntimeException(
                $existing['status'] === 'accepted'
                    ? 'Konten sind bereits verknüpft'
                    : 'Eine Verknüpfungsanfrage ist bereits vorhanden'
            );
        }

        $now = gmdate('Y-m-d H:i:s');
        Db::run(
            "INSERT INTO `account_links` (`requesterId`, `accepterId`, `status`, `createdAt`)
             VALUES (?, ?, 'pending', ?)",
            [$inviterId, $acceptorId, $now]
        );
        $linkId = Db::lastId();

        $inviter = Db::one(
            "SELECT `id`, `name`, `email`, `picture` FROM `users` WHERE `id` = ?",
            [$inviterId]
        );

        return [
            'id'         => $linkId,
            'status'     => 'pending',
            'direction'  => 'incoming',   // aus Sicht des Eingeladenen
            'linkedUser' => [
                'id'      => $inviterId,
                'name'    => $inviter['name']    ?? '',
                'email'   => $inviter['email']   ?? '',
                'picture' => $inviter['picture'] ?? null,
            ],
            'createdAt'  => $now,
        ];
    }

    // ── Einladungs-Details (öffentlich) ─────────────────────────────────────

    /**
     * Gibt öffentliche Infos zu einer Einladung zurück (für die Landingpage).
     * Kein Login erforderlich.
     */
    public static function getInvitationByToken(string $token): ?array
    {
        self::pruneExpiredInvitations();

        $inv = Db::one(
            "SELECT ai.`email`, ai.`expiresAt`,
                    u.`name` AS inviterName, u.`picture` AS inviterPicture
             FROM `account_invitations` ai
             JOIN `users` u ON u.`id` = ai.`inviterId`
             WHERE ai.`token` = ?",
            [$token]
        );
        if ($inv === null) {
            return null;
        }

        return [
            'inviterName'    => $inv['inviterName'],
            'inviterPicture' => $inv['inviterPicture'],
            'email'          => $inv['email'],
            'expiresAt'      => $inv['expiresAt'],
        ];
    }

    // ── Einladungen auflisten (eigene, gesendete) ────────────────────────────

    /**
     * Gibt alle noch gültigen, ausgehenden Einladungen des Nutzers zurück.
     */
    public static function getInvitations(int $userId): array
    {
        self::pruneExpiredInvitations();

        $rows = Db::all(
            "SELECT `id`, `email`, `expiresAt`, `createdAt`
             FROM `account_invitations`
             WHERE `inviterId` = ?
             ORDER BY `createdAt` DESC",
            [$userId]
        );

        return array_map(static fn($r) => [
            'id'        => (int) $r['id'],
            'email'     => $r['email'],
            'expiresAt' => $r['expiresAt'],
            'createdAt' => $r['createdAt'],
        ], $rows);
    }

    // ── Einladung zurückziehen ───────────────────────────────────────────────

    public static function cancelInvitation(int $id, int $userId): void
    {
        $inv = Db::one(
            "SELECT `id` FROM `account_invitations` WHERE `id` = ? AND `inviterId` = ?",
            [$id, $userId]
        );
        if ($inv === null) {
            throw new RuntimeException('Einladung nicht gefunden');
        }
        Db::run("DELETE FROM `account_invitations` WHERE `id` = ?", [$id]);
    }

    // ── Anfrage annehmen ─────────────────────────────────────────────────────

    public static function acceptLink(int $linkId, int $accepterId): array
    {
        $link = Db::one(
            "SELECT * FROM `account_links`
             WHERE `id` = ? AND `accepterId` = ? AND `status` = 'pending'",
            [$linkId, $accepterId]
        );
        if ($link === null) {
            throw new RuntimeException('Anfrage nicht gefunden');
        }

        Db::run(
            "UPDATE `account_links` SET `status` = 'accepted' WHERE `id` = ?",
            [$linkId]
        );

        $requester = Db::one(
            "SELECT `id`, `name`, `email`, `picture` FROM `users` WHERE `id` = ?",
            [(int) $link['requesterId']]
        );

        return [
            'id'         => $linkId,
            'status'     => 'accepted',
            'direction'  => 'incoming',
            'linkedUser' => $requester ? [
                'id'      => (int) $requester['id'],
                'name'    => $requester['name'],
                'email'   => $requester['email'],
                'picture' => $requester['picture'],
            ] : null,
        ];
    }

    // ── Verknüpfung entfernen ────────────────────────────────────────────────

    public static function removeLink(int $linkId, int $userId): void
    {
        $link = Db::one(
            "SELECT `id` FROM `account_links`
             WHERE `id` = ? AND (`requesterId` = ? OR `accepterId` = ?)",
            [$linkId, $userId, $userId]
        );
        if ($link === null) {
            throw new RuntimeException('Verknüpfung nicht gefunden');
        }
        Db::run("DELETE FROM `account_links` WHERE `id` = ?", [$linkId]);
    }

    // ── Verknüpfungen auflisten ──────────────────────────────────────────────

    public static function getLinks(int $userId): array
    {
        $rows = Db::all(
            "SELECT
                al.`id`, al.`requesterId`, al.`accepterId`, al.`status`, al.`createdAt`,
                u.`id`      AS uid,
                u.`name`    AS uname,
                u.`email`   AS uemail,
                u.`picture` AS upicture
             FROM `account_links` al
             JOIN `users` u ON u.`id` = IF(al.`requesterId` = ?, al.`accepterId`, al.`requesterId`)
             WHERE al.`requesterId` = ? OR al.`accepterId` = ?
             ORDER BY al.`createdAt` DESC",
            [$userId, $userId, $userId]
        );

        return array_map(static fn($r) => [
            'id'         => (int) $r['id'],
            'status'     => $r['status'],
            'direction'  => (int) $r['requesterId'] === $userId ? 'outgoing' : 'incoming',
            'linkedUser' => [
                'id'      => (int) $r['uid'],
                'name'    => $r['uname'],
                'email'   => $r['uemail'],
                'picture' => $r['upicture'],
            ],
            'createdAt'  => $r['createdAt'],
        ], $rows);
    }

    // ── Sichtbarkeits-Helfer ─────────────────────────────────────────────────

    public static function getVisibleUserIds(int $userId): array
    {
        $rows = Db::all(
            "SELECT IF(`requesterId` = ?, `accepterId`, `requesterId`) AS linkedId
             FROM `account_links`
             WHERE (`requesterId` = ? OR `accepterId` = ?) AND `status` = 'accepted'",
            [$userId, $userId, $userId]
        );

        $ids = [$userId];
        foreach ($rows as $r) {
            $ids[] = (int) $r['linkedId'];
        }
        return array_values(array_unique($ids));
    }

    // ── Internes ─────────────────────────────────────────────────────────────

    private static function pruneExpiredInvitations(): void
    {
        Db::run("DELETE FROM `account_invitations` WHERE `expiresAt` < ?", [gmdate('Y-m-d H:i:s')]);
    }
}
