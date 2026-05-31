<?php
declare(strict_types=1);

/**
 * Verknüpfte Konten.
 *
 * Zwei Nutzer können ihre Konten verknüpfen; danach sieht jeder die Rezepte
 * des anderen. Eine Verknüpfung beginnt als "pending" und wird erst nach
 * Bestätigung durch den Empfänger "accepted".
 */
final class Accounts
{
    // ── Verknüpfung anfragen ─────────────────────────────────────────────────

    /**
     * Sendet eine Verknüpfungsanfrage per E-Mail.
     * @throws RuntimeException bei unbekannter E-Mail oder bereits vorhandener Verknüpfung
     */
    public static function requestLink(int $requesterId, string $email): array
    {
        $target = Db::one(
            "SELECT `id`, `name`, `email`, `picture` FROM `users` WHERE `email` = ?",
            [$email]
        );
        if ($target === null) {
            throw new RuntimeException('Kein Konto mit dieser E-Mail-Adresse gefunden');
        }

        $targetId = (int) $target['id'];
        if ($targetId === $requesterId) {
            throw new RuntimeException('Du kannst dein Konto nicht mit dir selbst verknüpfen');
        }

        // Prüfen ob Verknüpfung in einer Richtung bereits existiert
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

    // ── Anfrage annehmen ─────────────────────────────────────────────────────

    /**
     * Nimmt eine ausstehende Verknüpfungsanfrage an.
     * @throws RuntimeException wenn die Anfrage nicht gefunden wird
     */
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

    // ── Anfrage ablehnen / Verknüpfung entfernen ─────────────────────────────

    /**
     * Entfernt eine Verknüpfung (beide Seiten dürfen entfernen).
     * @throws RuntimeException wenn die Verknüpfung nicht gefunden wird
     */
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

    /**
     * Alle Verknüpfungen eines Nutzers (ausstehend + angenommen, beide Richtungen).
     */
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

    /**
     * Gibt alle userId-Werte zurück, deren Rezepte für $userId sichtbar sind:
     * - der Nutzer selbst
     * - alle akzeptierten Verknüpfungspartner
     *
     * @return int[]
     */
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
}
