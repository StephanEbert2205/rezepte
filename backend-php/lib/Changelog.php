<?php
declare(strict_types=1);

/**
 * Changelog-Verwaltung.
 *
 * Öffentlich:  listPublished(), markRead()
 * Admin:       listAll(), getById(), create(), update(), delete(),
 *              publish(), unpublish()
 * Commits:     importCommits(), listCommits(), decideCommit(),
 *              bulkDecide(), buildDraft()
 */
class Changelog
{
    // ── Öffentliche Methoden ──────────────────────────────────────────────────

    /** Alle veröffentlichten Einträge, neueste zuerst. */
    public static function listPublished(): array
    {
        return Db::all(
            'SELECT * FROM `changelog_entries`
             WHERE `isPublished` = 1
             ORDER BY `releaseDate` DESC, `id` DESC'
        );
    }

    /** Letzten Lesezeitstempel des Nutzers auf NOW() setzen. */
    public static function markRead(int $userId): void
    {
        Db::run(
            'UPDATE `users` SET `lastChangelogReadAt` = NOW() WHERE `id` = ?',
            [$userId]
        );
    }

    // ── Admin: Changelog-Einträge ─────────────────────────────────────────────

    /** Alle Einträge (inkl. Entwürfe), neueste zuerst. */
    public static function listAll(): array
    {
        return Db::all(
            'SELECT * FROM `changelog_entries` ORDER BY `releaseDate` DESC, `id` DESC'
        );
    }

    /** Einzelnen Eintrag laden – null wenn nicht vorhanden. */
    public static function getById(int $id): ?array
    {
        return Db::one('SELECT * FROM `changelog_entries` WHERE `id` = ?', [$id]);
    }

    /** Neuen Eintrag erstellen. */
    public static function create(array $data): array
    {
        self::validate($data);
        Db::run(
            'INSERT INTO `changelog_entries`
                (`version`, `releaseDate`, `title`, `body`, `isPublished`, `gitHash`)
             VALUES (?, ?, ?, ?, ?, ?)',
            [
                self::str($data['version']  ?? null),
                $data['releaseDate'],
                trim($data['title']),
                trim($data['body']          ?? ''),
                (int) ($data['isPublished'] ?? 0),
                self::str($data['gitHash']  ?? null),
            ]
        );
        return self::getById(Db::lastId());
    }

    /** Eintrag aktualisieren. */
    public static function update(int $id, array $data): array
    {
        self::validate($data);
        Db::run(
            'UPDATE `changelog_entries`
             SET `version` = ?, `releaseDate` = ?, `title` = ?,
                 `body` = ?, `isPublished` = ?, `gitHash` = ?
             WHERE `id` = ?',
            [
                self::str($data['version']  ?? null),
                $data['releaseDate'],
                trim($data['title']),
                trim($data['body']          ?? ''),
                (int) ($data['isPublished'] ?? 0),
                self::str($data['gitHash']  ?? null),
                $id,
            ]
        );
        return self::getById($id);
    }

    public static function delete(int $id): void
    {
        Db::run('DELETE FROM `changelog_entries` WHERE `id` = ?', [$id]);
    }

    public static function publish(int $id): array
    {
        Db::run('UPDATE `changelog_entries` SET `isPublished` = 1 WHERE `id` = ?', [$id]);
        return self::getById($id);
    }

    public static function unpublish(int $id): array
    {
        Db::run('UPDATE `changelog_entries` SET `isPublished` = 0 WHERE `id` = ?', [$id]);
        return self::getById($id);
    }

    // ── Admin: Commit-Review ──────────────────────────────────────────────────

    /**
     * Importiert Commits aus dem deploy.js-Upload (.pending-commits.json).
     * Bereits bekannte Hashes werden übersprungen (UNIQUE-Constraint).
     * Technische Commits werden automatisch markiert.
     *
     * @return array{ imported: int, skippedExisting: int, deployTag: string }
     */
    public static function importCommits(): array
    {
        $file = dirname(__DIR__) . '/.pending-commits.json';
        if (!is_file($file)) {
            return ['imported' => 0, 'skippedExisting' => 0, 'deployTag' => ''];
        }

        $raw = json_decode((string) file_get_contents($file), true);
        if (!is_array($raw)) {
            return ['imported' => 0, 'skippedExisting' => 0, 'deployTag' => ''];
        }

        // Format: { deployTag: "...", commits: [...] }
        // Rückwärtskompatibel: falls noch altes Format (reines Array)
        if (isset($raw['commits'])) {
            $deployTag = (string) ($raw['deployTag'] ?? date('Y-m-d\TH:i'));
            $commits   = (array) $raw['commits'];
        } else {
            $deployTag = date('Y-m-d\TH:i');
            $commits   = $raw;
        }

        $imported        = 0;
        $skippedExisting = 0;

        foreach ($commits as $c) {
            $hash    = trim($c['hash']    ?? '');
            $short   = trim($c['short']   ?? substr($hash, 0, 7));
            $message = trim($c['message'] ?? '');
            $date    = trim($c['date']    ?? date('Y-m-d'));
            $author  = trim($c['author']  ?? '');

            if ($hash === '' || $message === '') {
                continue;
            }

            // Bereits importiert?
            if (Db::one('SELECT `id` FROM `changelog_commits` WHERE `hash` = ?', [$hash]) !== null) {
                $skippedExisting++;
                continue;
            }

            Db::run(
                'INSERT INTO `changelog_commits`
                    (`hash`, `shortHash`, `message`, `commitDate`, `author`, `deployTag`, `isTechnical`)
                 VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    $hash,
                    $short,
                    $message,
                    $date,
                    $author,
                    $deployTag,
                    self::isTechnical($message) ? 1 : 0,
                ]
            );
            $imported++;
        }

        return [
            'imported'        => $imported,
            'skippedExisting' => $skippedExisting,
            'deployTag'       => $deployTag,
        ];
    }

    /**
     * Alle Commits auflisten, neueste Commits zuerst.
     * Status-Filter: 'pending' | 'included' | 'skipped' | null (alle)
     */
    public static function listCommits(?string $status = null): array
    {
        if ($status !== null && in_array($status, ['pending', 'included', 'skipped'], true)) {
            return Db::all(
                'SELECT * FROM `changelog_commits`
                 WHERE `status` = ?
                 ORDER BY `commitDate` DESC, `id` DESC',
                [$status]
            );
        }
        return Db::all(
            'SELECT * FROM `changelog_commits` ORDER BY `commitDate` DESC, `id` DESC'
        );
    }

    /**
     * Einzelne Entscheidung für einen Commit setzen.
     * @throws RuntimeException wenn $decision ungültig
     */
    public static function decideCommit(int $id, string $decision): array
    {
        if (!in_array($decision, ['included', 'skipped'], true)) {
            throw new RuntimeException('Ungültige Entscheidung: ' . $decision);
        }
        Db::run(
            'UPDATE `changelog_commits` SET `status` = ?, `decidedAt` = NOW() WHERE `id` = ?',
            [$decision, $id]
        );
        $row = Db::one('SELECT * FROM `changelog_commits` WHERE `id` = ?', [$id]);
        return $row ?? [];
    }

    /**
     * Massen-Entscheidung für ausstehende Commits.
     * $filter: 'non-technical'  → nur nicht-technische Commits
     *          'technical'      → nur technische Commits
     *          'all'            → alle ausstehenden Commits
     * $decision: 'included' | 'skipped'
     */
    public static function bulkDecide(string $filter, string $decision): int
    {
        if (!in_array($decision, ['included', 'skipped'], true)) {
            throw new RuntimeException('Ungültige Entscheidung');
        }

        $base = "UPDATE `changelog_commits` SET `status` = ?, `decidedAt` = NOW()
                  WHERE `status` = 'pending'";

        if ($filter === 'non-technical') {
            $stmt = Db::run($base . ' AND `isTechnical` = 0', [$decision]);
        } elseif ($filter === 'technical') {
            $stmt = Db::run($base . ' AND `isTechnical` = 1', [$decision]);
        } else {
            $stmt = Db::run($base, [$decision]);
        }

        return $stmt->rowCount();
    }

    /**
     * Erstellt einen Changelog-Entwurf aus allen aufgenommenen Commits ohne
     * Eintragszuordnung. Verknüpft die Commits nachher mit dem neuen Eintrag.
     *
     * @return array|null  Den neuen Eintrag, oder null wenn keine Commits vorliegen.
     */
    public static function buildDraft(): ?array
    {
        // Aufgenommene Commits ohne Eintrag, neueste zuerst
        $commits = Db::all(
            "SELECT * FROM `changelog_commits`
             WHERE `status` = 'included' AND `entryId` IS NULL
             ORDER BY `commitDate` DESC, `id` DESC"
        );

        if (empty($commits)) {
            return null;
        }

        // Body: eine Zeile pro Commit
        $lines = array_map(static fn($c) => '• ' . $c['message'], $commits);
        $body  = implode("\n", $lines);

        // Datum des neuesten Commits als Release-Datum
        $releaseDate = $commits[0]['commitDate'];

        // Entwurf anlegen
        $entry = self::create([
            'title'       => 'App-Update ' . self::formatDateDe($releaseDate),
            'body'        => $body,
            'releaseDate' => $releaseDate,
            'isPublished' => 0,
            'version'     => null,
            'gitHash'     => $commits[0]['hash'] ?? null,
        ]);

        // Commits mit Eintrag verknüpfen
        $ids          = array_map(static fn($c) => (int) $c['id'], $commits);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        Db::run(
            "UPDATE `changelog_commits` SET `entryId` = ? WHERE `id` IN ($placeholders)",
            array_merge([$entry['id']], $ids)
        );

        return $entry;
    }

    /**
     * Zählt ausstehende (unentschiedene) Commits – für das Badge im Admin-Tab.
     */
    public static function countPending(): int
    {
        $row = Db::one("SELECT COUNT(*) AS cnt FROM `changelog_commits` WHERE `status` = 'pending'");
        return (int) ($row['cnt'] ?? 0);
    }

    // ── Intern ────────────────────────────────────────────────────────────────

    /**
     * Erkennt technische / changelog-irrelevante Commits.
     * Macht einen Vorschlag; der Admin kann jederzeit manuell überschreiben.
     */
    private static function isTechnical(string $message): bool
    {
        $patterns = [
            '/^merge (branch|pull request|remote|tag)\b/i',
            '/^merged?\b/i',
            '\bwip\b',                     // "WIP:" oder "work in progress"
            '/^deploy\b/i',
            '/^bump\b/i',
            '/^chore[\(:]/i',
            '/^build[\(:]/i',
            '/^ci[\(:]/i',
            '/^style[\(:]/i',
            '/fix typo/i',
            '/update (readme|changelog|package-lock|yarn\.lock|deps|dependencies)/i',
            '/^auto-/i',
            '/\[skip ci\]/i',
        ];

        $msg = trim($message);
        foreach ($patterns as $p) {
            // Regex oder Plain-String
            if ($p[0] === '/') {
                if (preg_match($p, $msg)) return true;
            } else {
                if (str_contains(mb_strtolower($msg), $p)) return true;
            }
        }
        return false;
    }

    private static function validate(array $data): void
    {
        if (empty(trim($data['title'] ?? ''))) {
            throw new RuntimeException('Titel ist erforderlich');
        }
        if (empty(trim($data['releaseDate'] ?? ''))) {
            throw new RuntimeException('Datum ist erforderlich');
        }
    }

    private static function str(mixed $v): ?string
    {
        if ($v === null) return null;
        $s = trim((string) $v);
        return $s === '' ? null : $s;
    }

    private static function formatDateDe(string $ymd): string
    {
        try {
            $d = new DateTimeImmutable($ymd);
            return $d->format('d.m.Y');
        } catch (\Throwable) {
            return $ymd;
        }
    }
}
