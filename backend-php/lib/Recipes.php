<?php
declare(strict_types=1);

/**
 * Datenzugriff + Serialisierung für Rezepte.
 * Erzeugt exakt die JSON-Struktur, die das React-Frontend erwartet
 * (siehe frontend/src/types/recipe.ts).
 *
 * Alle öffentlichen Methoden akzeptieren einen $userId-Parameter und
 * berücksichtigen Nutzer-Isolation, direkte Freigaben sowie verknüpfte Konten.
 */
final class Recipes
{
    // ── Serialisierungs-Helfer ──────────────────────────────────────────────

    private static function isoDate(?string $v): ?string
    {
        if ($v === null || $v === '') {
            return null;
        }
        try {
            $dt = new DateTime($v, new DateTimeZone('UTC'));
            return $dt->format('Y-m-d\TH:i:s.v\Z');
        } catch (Exception $e) {
            return null;
        }
    }

    private static function numOrNull($v): ?float
    {
        return $v === null ? null : (float) $v;
    }

    private static function intOrNull($v): ?int
    {
        return $v === null ? null : (int) $v;
    }

    private static function bool($v): bool
    {
        return (bool) (int) $v;
    }

    private static function serializeIngredient(array $r): array
    {
        return [
            'id'               => (int) $r['id'],
            'recipeId'         => (int) $r['recipeId'],
            'name'             => $r['name'],
            'normalizedName'   => $r['normalizedName'],
            'amountOriginal'   => $r['amountOriginal'],
            'unitOriginal'     => $r['unitOriginal'],
            'amountPerServing' => self::numOrNull($r['amountPerServing']),
            'unitNormalized'   => $r['unitNormalized'],
            'optional'         => self::bool($r['optional']),
            'notes'            => $r['notes'],
            'sortOrder'        => (int) $r['sortOrder'],
        ];
    }

    private static function serializeNutrition(array $r): array
    {
        return [
            'id'       => (int) $r['id'],
            'recipeId' => (int) $r['recipeId'],
            'calories' => self::numOrNull($r['calories']),
            'protein'  => self::numOrNull($r['protein']),
            'fat'      => self::numOrNull($r['fat']),
            'carbs'    => self::numOrNull($r['carbs']),
            'fiber'    => self::numOrNull($r['fiber']),
            'sugar'    => self::numOrNull($r['sugar']),
        ];
    }

    // ── Kern: Rezepte laden ─────────────────────────────────────────────────

    /**
     * Lädt vollständige Rezepte (inkl. Relationen) für die gegebenen IDs,
     * in derselben Reihenfolge wie $ids.
     * Enthält userId + ownerName; canEdit wird von Aufrufer ergänzt.
     *
     * @return array<int,array<string,mixed>>
     */
    public static function hydrate(array $ids): array
    {
        if (count($ids) === 0) {
            return [];
        }
        $ids   = array_map('intval', $ids);
        $place = implode(',', array_fill(0, count($ids), '?'));

        // Rezepte + Besitzer-Name per JOIN
        $recipeRows = Db::all(
            "SELECT r.*, u.`name` AS ownerName
             FROM `recipes` r
             LEFT JOIN `users` u ON u.`id` = r.`userId`
             WHERE r.`id` IN ($place)",
            $ids
        );
        $byId = [];
        foreach ($recipeRows as $row) {
            $byId[(int) $row['id']] = $row;
        }

        // Relationen gebündelt laden
        $ingredients = [];
        foreach (Db::all(
            "SELECT * FROM `ingredients` WHERE `recipeId` IN ($place) ORDER BY `sortOrder` ASC",
            $ids
        ) as $r) {
            $ingredients[(int) $r['recipeId']][] = self::serializeIngredient($r);
        }

        $instructions = [];
        foreach (Db::all(
            "SELECT * FROM `instructions` WHERE `recipeId` IN ($place) ORDER BY `stepNumber` ASC",
            $ids
        ) as $r) {
            $instructions[(int) $r['recipeId']][] = [
                'id'         => (int) $r['id'],
                'recipeId'   => (int) $r['recipeId'],
                'stepNumber' => (int) $r['stepNumber'],
                'content'    => $r['content'],
            ];
        }

        $tags = [];
        foreach (Db::all(
            "SELECT rt.`recipeId`, rt.`tagId`, t.`id` AS tId, t.`name` AS tName
             FROM `recipe_tags` rt JOIN `tags` t ON t.`id` = rt.`tagId`
             WHERE rt.`recipeId` IN ($place)",
            $ids
        ) as $r) {
            $tags[(int) $r['recipeId']][] = [
                'recipeId' => (int) $r['recipeId'],
                'tagId'    => (int) $r['tagId'],
                'tag'      => ['id' => (int) $r['tId'], 'name' => $r['tName']],
            ];
        }

        $nutrition = [];
        foreach (Db::all(
            "SELECT * FROM `nutrition` WHERE `recipeId` IN ($place)",
            $ids
        ) as $r) {
            $nutrition[(int) $r['recipeId']] = self::serializeNutrition($r);
        }

        $out = [];
        foreach ($ids as $id) {
            if (!isset($byId[$id])) {
                continue;
            }
            $row    = $byId[$id];
            $custom = null;
            if (isset($row['customIngredients']) && $row['customIngredients'] !== null && $row['customIngredients'] !== '') {
                $decoded = json_decode($row['customIngredients'], true);
                $custom  = is_array($decoded) ? $decoded : null;
            }
            $out[] = [
                'id'               => (int) $row['id'],
                'userId'           => self::intOrNull($row['userId']),
                'ownerName'        => $row['ownerName'],
                'title'            => $row['title'],
                'description'      => $row['description'],
                'sourceUrl'        => $row['sourceUrl'],
                'sourceDomain'     => $row['sourceDomain'],
                'servingsOriginal' => self::intOrNull($row['servingsOriginal']),
                'servingsBase'     => (int) $row['servingsBase'],
                'prepTime'         => self::intOrNull($row['prepTime']),
                'cookTime'         => self::intOrNull($row['cookTime']),
                'totalTime'        => self::intOrNull($row['totalTime']),
                'imageUrl'         => $row['imageUrl'],
                'difficulty'       => $row['difficulty'],
                'author'           => $row['author'],
                'isVegetarian'     => self::bool($row['isVegetarian']),
                'isVegan'          => self::bool($row['isVegan']),
                'isGlutenFree'     => self::bool($row['isGlutenFree']),
                'isLactoseFree'    => self::bool($row['isLactoseFree']),
                'customIngredients'=> $custom,
                'createdAt'        => self::isoDate($row['createdAt']),
                'updatedAt'        => self::isoDate($row['updatedAt']),
                'ingredients'      => $ingredients[$id] ?? [],
                'instructions'     => $instructions[$id] ?? [],
                'tags'             => $tags[$id] ?? [],
                'nutrition'        => $nutrition[$id] ?? null,
                // canEdit wird von Aufrufer (getById / listRecipes) gesetzt
                'canEdit'          => false,
            ];
        }
        return $out;
    }

    /**
     * Gibt canEdit-Map für eine Menge von Rezept-IDs und einen Nutzer zurück.
     * Schlüssel: recipeId, Wert: bool.
     *
     * @param int[] $ids
     * @return array<int,bool>
     */
    private static function buildCanEditMap(array $ids, int $userId): array
    {
        if (count($ids) === 0) {
            return [];
        }
        $place = implode(',', array_fill(0, count($ids), '?'));
        $shareRows = Db::all(
            "SELECT `recipeId`, `canEdit`
             FROM `recipe_shares`
             WHERE `recipeId` IN ($place) AND `sharedWithId` = ?",
            [...$ids, $userId]
        );
        $shareMap = [];
        foreach ($shareRows as $r) {
            $shareMap[(int) $r['recipeId']] = (bool) (int) $r['canEdit'];
        }
        return $shareMap;
    }

    // ── Zugriff ohne Nutzer-Prüfung (intern / Share-Token) ──────────────────

    /**
     * Liefert ein Rezept ohne Zugriffscheck (für Share-Token-Preview).
     * Setzt canEdit = false.
     */
    public static function getByIdRaw(int $id): ?array
    {
        $list = self::hydrate([$id]);
        return $list[0] ?? null;
    }

    // ── Öffentliche API ─────────────────────────────────────────────────────

    /**
     * Liefert ein Rezept, wenn der Nutzer Zugriff hat (Besitzer, Freigabe, Verknüpfung).
     */
    public static function getById(int $id, int $userId): ?array
    {
        // Zugriff prüfen
        if (!self::hasAccess($id, $userId)) {
            return null;
        }

        $recipe = self::getByIdRaw($id);
        if ($recipe === null) {
            return null;
        }

        // canEdit setzen
        $recipe['canEdit'] = self::computeCanEdit($recipe, $userId, [
            $id => self::buildCanEditMap([$id], $userId)[$id] ?? false,
        ]);

        return $recipe;
    }

    private static function escapeLike(string $term): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $term);
    }

    /**
     * Listet Rezepte mit Such- und Filterparametern.
     * Gibt nur Rezepte zurück, auf die $userId Zugriff hat.
     */
    public static function listRecipes(array $params, int $userId): array
    {
        $search       = isset($params['search']) ? trim((string) $params['search']) : '';
        $tags         = $params['tags'] ?? [];
        $isVegetarian = !empty($params['isVegetarian']);
        $isVegan      = !empty($params['isVegan']);
        $isGlutenFree = !empty($params['isGlutenFree']);
        $maxTime      = $params['maxTime'] ?? null;
        $page         = max(1, (int) ($params['page'] ?? 1));
        $limit        = (int) ($params['limit'] ?? 20);
        $limit        = max(1, min($limit, 100));
        $skip         = ($page - 1) * $limit;

        // Sichtbare userId-Werte (eigene + verknüpfte Konten)
        $visibleIds = Accounts::getVisibleUserIds($userId);
        $vPlace     = implode(',', array_fill(0, count($visibleIds), '?'));

        $where = [];
        $args  = [];

        // Sichtbarkeits-Filter: eigene + verknüpfte Konten + direkte Freigaben
        $where[] = "(r.`userId` IN ($vPlace)
                     OR r.`userId` IS NULL
                     OR EXISTS (
                         SELECT 1 FROM `recipe_shares` rs
                         WHERE rs.`recipeId` = r.`id` AND rs.`sharedWithId` = ?
                     ))";
        foreach ($visibleIds as $vid) {
            $args[] = $vid;
        }
        $args[] = $userId;

        if ($search !== '') {
            $like    = '%' . self::escapeLike($search) . '%';
            $where[] = '(`r`.`title` LIKE ?'
                . ' OR `r`.`description` LIKE ?'
                . ' OR EXISTS (SELECT 1 FROM `ingredients` i WHERE i.`recipeId` = r.`id` AND i.`name` LIKE ?)'
                . ' OR EXISTS (SELECT 1 FROM `recipe_tags` rt JOIN `tags` t ON t.`id` = rt.`tagId` WHERE rt.`recipeId` = r.`id` AND t.`name` LIKE ?))';
            $args[] = $like; $args[] = $like; $args[] = $like; $args[] = $like;
        }
        if ($isVegetarian) { $where[] = '`r`.`isVegetarian` = 1'; }
        if ($isVegan)      { $where[] = '`r`.`isVegan` = 1'; }
        if ($isGlutenFree) { $where[] = '`r`.`isGlutenFree` = 1'; }
        if ($maxTime !== null && $maxTime !== '') {
            $where[] = '`r`.`totalTime` <= ?';
            $args[]  = (int) $maxTime;
        }
        if (is_array($tags) && count($tags) > 0) {
            $tagPlace = implode(',', array_fill(0, count($tags), '?'));
            $where[]  = "EXISTS (SELECT 1 FROM `recipe_tags` rt JOIN `tags` t ON t.`id` = rt.`tagId` WHERE rt.`recipeId` = r.`id` AND t.`name` IN ($tagPlace))";
            foreach ($tags as $t) {
                $args[] = $t;
            }
        }

        $whereSql = 'WHERE ' . implode(' AND ', $where);

        $total  = (int) (Db::one("SELECT COUNT(*) AS c FROM `recipes` r $whereSql", $args)['c'] ?? 0);
        $idRows = Db::all(
            "SELECT r.`id` FROM `recipes` r $whereSql ORDER BY r.`createdAt` DESC LIMIT $limit OFFSET $skip",
            $args
        );
        $ids = array_map(static fn($x) => (int) $x['id'], $idRows);

        $recipes  = self::hydrate($ids);
        $shareMap = self::buildCanEditMap($ids, $userId);

        foreach ($recipes as &$r) {
            $r['canEdit'] = self::computeCanEdit($r, $userId, $shareMap);
        }
        unset($r);

        return [
            'recipes' => $recipes,
            'total'   => $total,
            'page'    => $page,
            'limit'   => $limit,
            'pages'   => (int) ceil($total / $limit),
        ];
    }

    public static function getAllTags(int $userId): array
    {
        $visibleIds = Accounts::getVisibleUserIds($userId);
        $vPlace     = implode(',', array_fill(0, count($visibleIds), '?'));

        $rows = Db::all(
            "SELECT t.`id`, t.`name`, COUNT(rt.`recipeId`) AS cnt
             FROM `tags` t
             LEFT JOIN `recipe_tags` rt ON rt.`tagId` = t.`id`
             LEFT JOIN `recipes` r ON r.`id` = rt.`recipeId`
             WHERE r.`id` IS NULL
                OR r.`userId` IN ($vPlace)
                OR r.`userId` IS NULL
                OR EXISTS (
                    SELECT 1 FROM `recipe_shares` rs
                    WHERE rs.`recipeId` = r.`id` AND rs.`sharedWithId` = ?
                )
             GROUP BY t.`id`, t.`name`
             ORDER BY cnt DESC",
            [...$visibleIds, $userId]
        );

        return array_map(static fn($r) => [
            'id'    => (int) $r['id'],
            'name'  => $r['name'],
            'count' => (int) $r['cnt'],
        ], $rows);
    }

    /** Tag per Name finden oder anlegen, gibt Tag-ID zurück. */
    public static function upsertTag(string $name): int
    {
        $row = Db::one("SELECT `id` FROM `tags` WHERE `name` = ?", [$name]);
        if ($row !== null) {
            return (int) $row['id'];
        }
        Db::run("INSERT INTO `tags` (`name`) VALUES (?)", [$name]);
        return Db::lastId();
    }

    /**
     * @return array{0:?array,1:?string} [serialisiertes Rezept|null, fehler|null]
     */
    public static function update(int $id, int $userId, array $data): array
    {
        // Bearbeitungsrecht prüfen (Besitzer ODER Freigabe mit canEdit)
        if (!self::hasEditAccess($id, $userId)) {
            return [null, 'Rezept nicht gefunden oder keine Berechtigung'];
        }

        $columns = [
            'title', 'description', 'servingsOriginal', 'prepTime', 'cookTime',
            'totalTime', 'imageUrl', 'isVegetarian', 'isVegan', 'isGlutenFree', 'isLactoseFree',
        ];

        $set  = [];
        $args = [];
        foreach ($columns as $col) {
            if (array_key_exists($col, $data)) {
                $set[] = "`$col` = ?";
                $val   = $data[$col];
                if (is_bool($val)) {
                    $val = $val ? 1 : 0;
                }
                $args[] = $val;
            }
        }

        if (array_key_exists('customIngredients', $data)) {
            $ci = $data['customIngredients'];
            if ($ci === null || (is_array($ci) && count($ci) === 0)) {
                $set[] = '`customIngredients` = NULL';
            } else {
                $set[]  = '`customIngredients` = ?';
                $args[] = json_encode($ci, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
        }

        $set[]  = '`updatedAt` = ?';
        $args[] = gmdate('Y-m-d H:i:s');

        Db::begin();
        try {
            if (count($set) > 0) {
                $args[] = $id;
                Db::run("UPDATE `recipes` SET " . implode(', ', $set) . " WHERE `id` = ?", $args);
            }

            if (array_key_exists('tags', $data) && is_array($data['tags'])) {
                Db::run("DELETE FROM `recipe_tags` WHERE `recipeId` = ?", [$id]);
                foreach ($data['tags'] as $tagName) {
                    $tagId = self::upsertTag((string) $tagName);
                    Db::run(
                        "INSERT IGNORE INTO `recipe_tags` (`recipeId`, `tagId`) VALUES (?, ?)",
                        [$id, $tagId]
                    );
                }
            }
            Db::commit();
        } catch (Throwable $e) {
            Db::rollback();
            throw $e;
        }

        return [self::getById($id, $userId), null];
    }

    /**
     * Legt ein neues Rezept aus manueller Eingabe an.
     * $data entspricht dem validierten Ergebnis von Validator::createBody().
     */
    public static function create(array $data, int $userId): int
    {
        $servings = isset($data['servingsOriginal']) && (int) $data['servingsOriginal'] > 0
            ? (int) $data['servingsOriginal']
            : 4;
        $now = gmdate('Y-m-d H:i:s');

        Db::begin();
        try {
            Db::run(
                "INSERT INTO `recipes`
                    (`userId`, `title`, `description`, `servingsOriginal`,
                     `servingsBase`, `prepTime`, `cookTime`, `totalTime`, `imageUrl`,
                     `isVegetarian`, `isVegan`, `isGlutenFree`, `isLactoseFree`,
                     `createdAt`, `updatedAt`)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    $userId,
                    $data['title'],
                    ($data['description'] ?? '') !== '' ? $data['description'] : null,
                    $data['servingsOriginal'] ?? null,
                    $servings,
                    $data['prepTime'] ?? null,
                    $data['cookTime'] ?? null,
                    $data['totalTime'] ?? null,
                    $data['imageUrl'] ?? null,
                    !empty($data['isVegetarian']) ? 1 : 0,
                    !empty($data['isVegan'])      ? 1 : 0,
                    !empty($data['isGlutenFree']) ? 1 : 0,
                    !empty($data['isLactoseFree'])? 1 : 0,
                    $now,
                    $now,
                ]
            );
            $recipeId = Db::lastId();

            $insIng = Db::pdo()->prepare(
                "INSERT INTO `ingredients`
                    (`recipeId`, `name`, `normalizedName`, `amountOriginal`, `unitOriginal`,
                     `amountPerServing`, `unitNormalized`, `optional`, `notes`, `sortOrder`)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            foreach (($data['ingredients'] ?? []) as $idx => $ing) {
                $amount = $ing['amount'] ?? '';
                $unit   = $ing['unit']   ?? '';
                $amountPerServing = null;
                if ($amount !== '' && is_numeric($amount) && $servings > 0) {
                    $amountPerServing = (float) $amount / $servings;
                }
                $insIng->execute([
                    $recipeId,
                    $ing['name'],
                    Normalize::ingredientName($ing['name']),
                    $amount !== '' ? $amount : null,
                    $unit   !== '' ? $unit   : null,
                    $amountPerServing,
                    $unit   !== '' ? $unit   : null,
                    !empty($ing['optional']) ? 1 : 0,
                    ($ing['notes'] ?? '') !== '' ? $ing['notes'] : null,
                    $idx,
                ]);
            }

            $insStep = Db::pdo()->prepare(
                "INSERT INTO `instructions` (`recipeId`, `stepNumber`, `content`) VALUES (?, ?, ?)"
            );
            foreach (($data['instructions'] ?? []) as $idx => $inst) {
                $insStep->execute([$recipeId, $idx + 1, $inst['content']]);
            }

            foreach (($data['tags'] ?? []) as $tagName) {
                $tagId = self::upsertTag((string) $tagName);
                Db::run(
                    "INSERT IGNORE INTO `recipe_tags` (`recipeId`, `tagId`) VALUES (?, ?)",
                    [$recipeId, $tagId]
                );
            }

            Db::commit();
            return $recipeId;
        } catch (Throwable $e) {
            Db::rollback();
            throw $e;
        }
    }

    /**
     * Löscht ein Rezept (nur der Besitzer darf löschen).
     * @throws RuntimeException wenn kein Eigentümer-Recht besteht
     */
    public static function delete(int $id, int $userId): void
    {
        $exists = Db::one(
            "SELECT `id` FROM `recipes` WHERE `id` = ? AND `userId` = ?",
            [$id, $userId]
        );
        if ($exists === null) {
            throw new RuntimeException('Rezept nicht gefunden oder keine Berechtigung');
        }
        Db::run("DELETE FROM `recipes` WHERE `id` = ?", [$id]);
    }

    // ── Zugriffs-Helfer ─────────────────────────────────────────────────────

    /**
     * Prüft ob der Nutzer ein Rezept sehen darf:
     * - Besitzer oder NULL-userId (Legacy)
     * - Verknüpftes Konto
     * - Direkte Freigabe
     */
    public static function hasAccess(int $recipeId, int $userId): bool
    {
        $recipe = Db::one(
            "SELECT `userId` FROM `recipes` WHERE `id` = ?",
            [$recipeId]
        );
        if ($recipe === null) {
            return false;
        }

        // Eigentümer oder Legacy (userId = NULL)
        if ($recipe['userId'] === null || (int) $recipe['userId'] === $userId) {
            return true;
        }

        // Verknüpfte Konten
        $visibleIds = Accounts::getVisibleUserIds($userId);
        if (in_array((int) $recipe['userId'], $visibleIds, true)) {
            return true;
        }

        // Direkte Freigabe
        $share = Db::one(
            "SELECT `id` FROM `recipe_shares` WHERE `recipeId` = ? AND `sharedWithId` = ?",
            [$recipeId, $userId]
        );
        return $share !== null;
    }

    /**
     * Prüft ob der Nutzer ein Rezept bearbeiten darf:
     * - Besitzer
     * - Direkte Freigabe mit canEdit = 1
     */
    public static function hasEditAccess(int $recipeId, int $userId): bool
    {
        $recipe = Db::one(
            "SELECT `userId` FROM `recipes` WHERE `id` = ?",
            [$recipeId]
        );
        if ($recipe === null) {
            return false;
        }

        // Besitzer oder Legacy
        if ($recipe['userId'] === null || (int) $recipe['userId'] === $userId) {
            return true;
        }

        // Freigabe mit canEdit
        $share = Db::one(
            "SELECT `canEdit` FROM `recipe_shares`
             WHERE `recipeId` = ? AND `sharedWithId` = ? AND `canEdit` = 1",
            [$recipeId, $userId]
        );
        return $share !== null;
    }

    /**
     * Berechnet canEdit für ein hydriertes Rezept anhand des aktuellen Nutzers.
     *
     * @param array<int,bool> $shareMap  recipeId → canEdit (aus buildCanEditMap)
     */
    private static function computeCanEdit(array $recipe, int $userId, array $shareMap): bool
    {
        // Besitzer oder Legacy (userId = NULL)
        if ($recipe['userId'] === null || (int) $recipe['userId'] === $userId) {
            return true;
        }
        // Direkte Freigabe mit canEdit
        return $shareMap[$recipe['id']] ?? false;
    }
}
