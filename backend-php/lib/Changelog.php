<?php
declare(strict_types=1);

/**
 * Changelog-Verwaltung.
 *
 * Öffentlich:      listPublished(), markRead()
 * Admin-Einträge:  listAll(), getById(), create(), update(), delete(),
 *                  publish(), unpublish()
 * Admin-Commits:   importCommits(), listCommits(), decideCommit(),
 *                  bulkDecide(), buildDraft()
 * KI-Entwürfe:     listAiPending(), approveAiDraft(), skipAiDraft()
 */
class Changelog
{
    // ── Öffentlich ────────────────────────────────────────────────────────────

    public static function listPublished(): array
    {
        return Db::all(
            'SELECT * FROM `changelog_entries`
             WHERE `isPublished` = 1
             ORDER BY `releaseDate` DESC, `id` DESC'
        );
    }

    public static function markRead(int $userId): void
    {
        Db::run(
            'UPDATE `users` SET `lastChangelogReadAt` = NOW() WHERE `id` = ?',
            [$userId]
        );
    }

    // ── Admin: Einträge ───────────────────────────────────────────────────────

    public static function listAll(): array
    {
        return Db::all(
            'SELECT * FROM `changelog_entries` ORDER BY `releaseDate` DESC, `id` DESC'
        );
    }

    public static function getById(int $id): ?array
    {
        return Db::one('SELECT * FROM `changelog_entries` WHERE `id` = ?', [$id]);
    }

    public static function create(array $data): array
    {
        self::validate($data);
        Db::run(
            'INSERT INTO `changelog_entries`
                (`version`, `releaseDate`, `title`, `body`, `isPublished`, `gitHash`, `isAiGenerated`)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                self::str($data['version']      ?? null),
                $data['releaseDate'],
                trim($data['title']),
                trim($data['body']              ?? ''),
                (int) ($data['isPublished']     ?? 0),
                self::str($data['gitHash']      ?? null),
                (int) ($data['isAiGenerated']   ?? 0),
            ]
        );
        return self::getById(Db::lastId());
    }

    public static function update(int $id, array $data): array
    {
        self::validate($data);
        Db::run(
            'UPDATE `changelog_entries`
             SET `version` = ?, `releaseDate` = ?, `title` = ?,
                 `body` = ?, `isPublished` = ?, `gitHash` = ?, `isAiGenerated` = ?
             WHERE `id` = ?',
            [
                self::str($data['version']    ?? null),
                $data['releaseDate'],
                trim($data['title']),
                trim($data['body']            ?? ''),
                (int) ($data['isPublished']   ?? 0),
                self::str($data['gitHash']    ?? null),
                (int) ($data['isAiGenerated'] ?? 0),
                $id,
            ]
        );
        return self::getById($id);
    }

    public static function delete(int $id): void
    {
        Db::run('DELETE FROM `changelog_entries` WHERE `id` = ?', [$id]);
        // Zugehörige Commits-Verknüpfung aufheben
        Db::run('UPDATE `changelog_commits` SET `entryId` = NULL WHERE `entryId` = ?', [$id]);
    }

    public static function publish(int $id): array
    {
        Db::run(
            'UPDATE `changelog_entries` SET `isPublished` = 1, `isAiGenerated` = 0 WHERE `id` = ?',
            [$id]
        );
        return self::getById($id);
    }

    public static function unpublish(int $id): array
    {
        Db::run('UPDATE `changelog_entries` SET `isPublished` = 0 WHERE `id` = ?', [$id]);
        return self::getById($id);
    }

    // ── Admin: KI-Entwürfe ────────────────────────────────────────────────────

    /**
     * Alle vom KI generierten, noch nicht freigegebenen Entwürfe.
     */
    public static function listAiPending(): array
    {
        return Db::all(
            "SELECT * FROM `changelog_entries`
             WHERE `isAiGenerated` = 1 AND `isPublished` = 0
             ORDER BY `createdAt` DESC"
        );
    }

    /**
     * KI-Entwurf freigeben (Aufnehmen):
     * Setzt isAiGenerated=0, isPublished=1 → erscheint öffentlich.
     */
    public static function approveAiDraft(int $id): array
    {
        Db::run(
            'UPDATE `changelog_entries`
             SET `isPublished` = 1, `isAiGenerated` = 0
             WHERE `id` = ? AND `isAiGenerated` = 1',
            [$id]
        );
        return self::getById($id);
    }

    /**
     * KI-Entwurf ablehnen (Überspringen): löscht den Eintrag.
     */
    public static function skipAiDraft(int $id): void
    {
        Db::run(
            'DELETE FROM `changelog_entries` WHERE `id` = ? AND `isAiGenerated` = 1',
            [$id]
        );
        Db::run('UPDATE `changelog_commits` SET `entryId` = NULL WHERE `entryId` = ?', [$id]);
    }

    // ── Admin: Commit-Review ──────────────────────────────────────────────────

    /**
     * Importiert Commits aus api/.pending-commits.json.
     * Erstellt bei vorhandenem aiDraft automatisch einen KI-Entwurf-Eintrag.
     *
     * @return array{imported:int, skippedExisting:int, deployTag:string, aiEntry:array|null}
     */
    public static function importCommits(): array
    {
        $file = dirname(__DIR__) . '/.pending-commits.json';
        if (!is_file($file)) {
            return ['imported' => 0, 'skippedExisting' => 0, 'deployTag' => '', 'aiEntry' => null];
        }

        $raw = json_decode((string) file_get_contents($file), true);
        if (!is_array($raw)) {
            return ['imported' => 0, 'skippedExisting' => 0, 'deployTag' => '', 'aiEntry' => null];
        }

        // Format: { deployTag, commits, aiDraft? }
        if (isset($raw['commits'])) {
            $deployTag = (string) ($raw['deployTag'] ?? date('Y-m-d\TH:i'));
            $commits   = (array)  $raw['commits'];
            $aiDraft   = $raw['aiDraft'] ?? null;
        } else {
            $deployTag = date('Y-m-d\TH:i');
            $commits   = $raw;
            $aiDraft   = null;
        }

        $imported        = 0;
        $skippedExisting = 0;
        $importedIds     = [];

        foreach ($commits as $c) {
            $hash    = trim($c['hash']    ?? '');
            $short   = trim($c['short']   ?? substr($hash, 0, 7));
            $message = trim($c['message'] ?? '');
            $date    = trim($c['date']    ?? date('Y-m-d'));
            $author  = trim($c['author']  ?? '');

            if ($hash === '' || $message === '') {
                continue;
            }

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
            $importedIds[] = Db::lastId();
            $imported++;
        }

        // KI-Entwurf anlegen, wenn vorhanden und neue Commits importiert wurden
        $aiEntry = null;
        if ($aiDraft !== null && $imported > 0) {
            $title       = trim((string) ($aiDraft['title'] ?? ''));
            $body        = trim((string) ($aiDraft['body']  ?? ''));
            $releaseDate = date('Y-m-d');

            if ($title !== '' && $body !== '') {
                // Prüfen ob für diesen deployTag bereits ein KI-Entwurf existiert
                $existing = Db::one(
                    "SELECT `id` FROM `changelog_entries`
                     WHERE `isAiGenerated` = 1 AND `gitHash` = ?",
                    [$deployTag]
                );

                if ($existing === null) {
                    $aiEntry = self::create([
                        'title'        => $title,
                        'body'         => $body,
                        'releaseDate'  => $releaseDate,
                        'isPublished'  => 0,
                        'isAiGenerated'=> 1,
                        'gitHash'      => $deployTag,  // deployTag als Referenz-Schlüssel
                        'version'      => null,
                    ]);

                    // Neu importierte Commits mit dem Entwurf verknüpfen
                    if (!empty($importedIds)) {
                        $placeholders = implode(',', array_fill(0, count($importedIds), '?'));
                        Db::run(
                            "UPDATE `changelog_commits` SET `entryId` = ? WHERE `id` IN ($placeholders)",
                            array_merge([$aiEntry['id']], $importedIds)
                        );
                    }
                } else {
                    $aiEntry = self::getById((int) $existing['id']);
                }
            }
        }

        return [
            'imported'        => $imported,
            'skippedExisting' => $skippedExisting,
            'deployTag'       => $deployTag,
            'aiEntry'         => $aiEntry,
        ];
    }

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

    public static function decideCommit(int $id, string $decision): array
    {
        if (!in_array($decision, ['included', 'skipped'], true)) {
            throw new RuntimeException('Ungültige Entscheidung: ' . $decision);
        }
        Db::run(
            'UPDATE `changelog_commits` SET `status` = ?, `decidedAt` = NOW() WHERE `id` = ?',
            [$decision, $id]
        );
        return Db::one('SELECT * FROM `changelog_commits` WHERE `id` = ?', [$id]) ?? [];
    }

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

    public static function buildDraft(): ?array
    {
        $commits = Db::all(
            "SELECT * FROM `changelog_commits`
             WHERE `status` = 'included' AND `entryId` IS NULL
             ORDER BY `commitDate` DESC, `id` DESC"
        );
        if (empty($commits)) {
            return null;
        }
        $lines = array_map(static fn($c) => '• ' . $c['message'], $commits);
        $entry = self::create([
            'title'       => 'App-Update ' . self::formatDateDe($commits[0]['commitDate']),
            'body'        => implode("\n", $lines),
            'releaseDate' => $commits[0]['commitDate'],
            'isPublished' => 0,
            'version'     => null,
            'gitHash'     => $commits[0]['hash'] ?? null,
        ]);
        $ids          = array_map(static fn($c) => (int) $c['id'], $commits);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        Db::run(
            "UPDATE `changelog_commits` SET `entryId` = ? WHERE `id` IN ($placeholders)",
            array_merge([$entry['id']], $ids)
        );
        return $entry;
    }

    public static function countPending(): int
    {
        $row = Db::one("SELECT COUNT(*) AS cnt FROM `changelog_commits` WHERE `status` = 'pending'");
        return (int) ($row['cnt'] ?? 0);
    }

    // ── Intern ────────────────────────────────────────────────────────────────

    private static function isTechnical(string $message): bool
    {
        $patterns = [
            '/^merge (branch|pull request|remote|tag)\b/i',
            '/^merged?\b/i',
            '\bwip\b',
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
            return (new DateTimeImmutable($ymd))->format('d.m.Y');
        } catch (\Throwable) {
            return $ymd;
        }
    }
}
