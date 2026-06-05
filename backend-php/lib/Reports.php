<?php
declare(strict_types=1);

/**
 * Problemm­eldungen für Rezepte.
 */
final class Reports
{
    /** Erlaubte Kategorien */
    public const CATEGORIES = [
        'import_error'         => 'Rezept wird nicht importiert',
        'wrong_ingredients'    => 'Falsche Zutaten / Mengen',
        'wrong_steps'          => 'Fehlende / falsche Schritte',
        'wrong_image_or_diet'  => 'Falsches Bild oder Diät-Flag',
        'other'                => 'Sonstiges',
    ];

    // ── Meldung einreichen ────────────────────────────────────────────────────

    /**
     * @param int      $recipeId   Gemeldetes Rezept
     * @param int      $userId     Meldender Nutzer
     * @param string[] $categories Mindestens eine gültige Kategorie
     * @param string   $comment    Optionaler Freitext
     */
    public static function create(int $recipeId, int $userId, array $categories, string $comment): int
    {
        // Validierung
        if (empty($categories)) {
            throw new RuntimeException('Bitte mindestens eine Kategorie auswählen');
        }
        $valid = array_keys(self::CATEGORIES);
        foreach ($categories as $cat) {
            if (!in_array($cat, $valid, true)) {
                throw new RuntimeException('Ungültige Kategorie: ' . $cat);
            }
        }
        $comment = trim($comment);
        if (mb_strlen($comment) > 2000) {
            throw new RuntimeException('Kommentar zu lang (max. 2000 Zeichen)');
        }

        // Rezept muss existieren (DELETE CASCADE sorgt danach für saubere Löschung)
        if (Db::one("SELECT `id` FROM `recipes` WHERE `id` = ?", [$recipeId]) === null) {
            throw new RuntimeException('Rezept nicht gefunden');
        }

        // Doppelt-Meldung vom selben Nutzer innerhalb von 24 h verhindern
        $recent = Db::one(
            "SELECT `id` FROM `recipe_reports`
             WHERE `recipeId` = ? AND `userId` = ? AND `createdAt` > ?",
            [$recipeId, $userId, gmdate('Y-m-d H:i:s', time() - 86400)]
        );
        if ($recent !== null) {
            throw new RuntimeException('Du hast dieses Rezept bereits kürzlich gemeldet');
        }

        Db::run(
            "INSERT INTO `recipe_reports`
                (`recipeId`, `userId`, `categories`, `comment`, `status`, `createdAt`)
             VALUES (?, ?, ?, ?, 'open', ?)",
            [
                $recipeId,
                $userId,
                implode(',', $categories),
                $comment !== '' ? $comment : null,
                gmdate('Y-m-d H:i:s'),
            ]
        );

        return Db::lastId();
    }

    // ── Admin: alle Meldungen auflisten ──────────────────────────────────────

    public static function getAll(string $status = 'open'): array
    {
        $where  = in_array($status, ['open', 'resolved'], true) ? "`rr`.`status` = ?" : '1=1';
        $binds  = in_array($status, ['open', 'resolved'], true) ? [$status] : [];

        $rows = Db::all(
            "SELECT
                rr.`id`, rr.`categories`, rr.`comment`,
                rr.`status`, rr.`createdAt`, rr.`resolvedAt`,
                r.`id`    AS recipeId,
                r.`title` AS recipeTitle,
                r.`sourceDomain`,
                u.`id`    AS uid,
                u.`name`  AS uname,
                u.`email` AS uemail
             FROM `recipe_reports` rr
             JOIN `recipes` r ON r.`id` = rr.`recipeId`
             JOIN `users`   u ON u.`id` = rr.`userId`
             WHERE $where
             ORDER BY rr.`createdAt` DESC",
            $binds
        );

        $labels = self::CATEGORIES;

        return array_map(static function ($r) use ($labels) {
            $cats = array_filter(explode(',', $r['categories']));
            return [
                'id'          => (int) $r['id'],
                'status'      => $r['status'],
                'createdAt'   => $r['createdAt'],
                'resolvedAt'  => $r['resolvedAt'],
                'categories'  => $cats,
                'categoryLabels' => array_values(array_map(
                    static fn($c) => $labels[$c] ?? $c,
                    $cats
                )),
                'comment'     => $r['comment'],
                'recipe'      => [
                    'id'     => (int) $r['recipeId'],
                    'title'  => $r['recipeTitle'],
                    'source' => $r['sourceDomain'],
                ],
                'reporter'    => [
                    'id'    => (int) $r['uid'],
                    'name'  => $r['uname'],
                    'email' => $r['uemail'],
                ],
            ];
        }, $rows);
    }

    // ── Admin: Meldung als erledigt markieren ─────────────────────────────────

    public static function resolve(int $reportId): void
    {
        $report = Db::one("SELECT `id` FROM `recipe_reports` WHERE `id` = ?", [$reportId]);
        if ($report === null) {
            throw new RuntimeException('Meldung nicht gefunden');
        }
        Db::run(
            "UPDATE `recipe_reports`
             SET `status` = 'resolved', `resolvedAt` = ?
             WHERE `id` = ?",
            [gmdate('Y-m-d H:i:s'), $reportId]
        );
    }

    // ── Anzahl offener Meldungen (für Stats) ─────────────────────────────────

    public static function countOpen(): int
    {
        $row = Db::one("SELECT COUNT(*) AS c FROM `recipe_reports` WHERE `status` = 'open'");
        return (int) ($row['c'] ?? 0);
    }
}
