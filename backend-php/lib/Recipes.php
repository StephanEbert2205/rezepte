<?php
declare(strict_types=1);

/**
 * Datenzugriff + Serialisierung für Rezepte.
 * Erzeugt exakt die JSON-Struktur, die das React-Frontend erwartet
 * (siehe frontend/src/types/recipe.ts).
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

    /**
     * Lädt vollständige Rezepte (inkl. Relationen) für die gegebenen IDs,
     * in derselben Reihenfolge wie $ids.
     * @return array<int,array<string,mixed>>
     */
    public static function hydrate(array $ids): array
    {
        if (count($ids) === 0) {
            return [];
        }
        $ids = array_map('intval', $ids);
        $place = implode(',', array_fill(0, count($ids), '?'));

        $recipeRows = Db::all("SELECT * FROM `recipes` WHERE `id` IN ($place)", $ids);
        $byId = [];
        foreach ($recipeRows as $row) {
            $byId[(int) $row['id']] = $row;
        }

        // Relationen gebündelt laden
        $ingredients = [];
        foreach (Db::all("SELECT * FROM `ingredients` WHERE `recipeId` IN ($place) ORDER BY `sortOrder` ASC", $ids) as $r) {
            $ingredients[(int) $r['recipeId']][] = self::serializeIngredient($r);
        }

        $instructions = [];
        foreach (Db::all("SELECT * FROM `instructions` WHERE `recipeId` IN ($place) ORDER BY `stepNumber` ASC", $ids) as $r) {
            $instructions[(int) $r['recipeId']][] = [
                'id'         => (int) $r['id'],
                'recipeId'   => (int) $r['recipeId'],
                'stepNumber' => (int) $r['stepNumber'],
                'content'    => $r['content'],
            ];
        }

        $tags = [];
        $tagSql = "SELECT rt.`recipeId`, rt.`tagId`, t.`id` AS tId, t.`name` AS tName
                   FROM `recipe_tags` rt JOIN `tags` t ON t.`id` = rt.`tagId`
                   WHERE rt.`recipeId` IN ($place)";
        foreach (Db::all($tagSql, $ids) as $r) {
            $tags[(int) $r['recipeId']][] = [
                'recipeId' => (int) $r['recipeId'],
                'tagId'    => (int) $r['tagId'],
                'tag'      => ['id' => (int) $r['tId'], 'name' => $r['tName']],
            ];
        }

        $nutrition = [];
        foreach (Db::all("SELECT * FROM `nutrition` WHERE `recipeId` IN ($place)", $ids) as $r) {
            $nutrition[(int) $r['recipeId']] = self::serializeNutrition($r);
        }

        $out = [];
        foreach ($ids as $id) {
            if (!isset($byId[$id])) {
                continue;
            }
            $row = $byId[$id];
            $custom = null;
            if (isset($row['customIngredients']) && $row['customIngredients'] !== null && $row['customIngredients'] !== '') {
                $decoded = json_decode($row['customIngredients'], true);
                $custom = is_array($decoded) ? $decoded : null;
            }
            $out[] = [
                'id'               => (int) $row['id'],
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
            ];
        }
        return $out;
    }

    public static function getById(int $id): ?array
    {
        $list = self::hydrate([$id]);
        return $list[0] ?? null;
    }

    private static function escapeLike(string $term): string
    {
        // \ % _ für LIKE maskieren
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $term);
    }

    public static function listRecipes(array $params): array
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

        $where  = [];
        $args   = [];

        if ($search !== '') {
            $like = '%' . self::escapeLike($search) . '%';
            $where[] = '(`r`.`title` LIKE ? '
                . 'OR `r`.`description` LIKE ? '
                . 'OR EXISTS (SELECT 1 FROM `ingredients` i WHERE i.`recipeId` = r.`id` AND i.`name` LIKE ?) '
                . 'OR EXISTS (SELECT 1 FROM `recipe_tags` rt JOIN `tags` t ON t.`id` = rt.`tagId` WHERE rt.`recipeId` = r.`id` AND t.`name` LIKE ?))';
            $args[] = $like; $args[] = $like; $args[] = $like; $args[] = $like;
        }
        if ($isVegetarian) { $where[] = '`r`.`isVegetarian` = 1'; }
        if ($isVegan)      { $where[] = '`r`.`isVegan` = 1'; }
        if ($isGlutenFree) { $where[] = '`r`.`isGlutenFree` = 1'; }
        if ($maxTime !== null && $maxTime !== '') {
            $where[] = '`r`.`totalTime` <= ?';
            $args[] = (int) $maxTime;
        }
        if (is_array($tags) && count($tags) > 0) {
            $tagPlace = implode(',', array_fill(0, count($tags), '?'));
            $where[] = "EXISTS (SELECT 1 FROM `recipe_tags` rt JOIN `tags` t ON t.`id` = rt.`tagId` WHERE rt.`recipeId` = r.`id` AND t.`name` IN ($tagPlace))";
            foreach ($tags as $t) { $args[] = $t; }
        }

        $whereSql = count($where) > 0 ? ('WHERE ' . implode(' AND ', $where)) : '';

        $total = (int) (Db::one("SELECT COUNT(*) AS c FROM `recipes` r $whereSql", $args)['c'] ?? 0);

        // IDs der aktuellen Seite (LIMIT/OFFSET als Literale – validierte Integer)
        $idRows = Db::all(
            "SELECT r.`id` FROM `recipes` r $whereSql ORDER BY r.`createdAt` DESC LIMIT $limit OFFSET $skip",
            $args
        );
        $ids = array_map(static fn($x) => (int) $x['id'], $idRows);

        $recipes = self::hydrate($ids);

        return [
            'recipes' => $recipes,
            'total'   => $total,
            'page'    => $page,
            'limit'   => $limit,
            'pages'   => (int) ceil($total / $limit),
        ];
    }

    public static function getAllTags(): array
    {
        $rows = Db::all(
            "SELECT t.`id`, t.`name`, COUNT(rt.`recipeId`) AS cnt
             FROM `tags` t
             LEFT JOIN `recipe_tags` rt ON rt.`tagId` = t.`id`
             GROUP BY t.`id`, t.`name`
             ORDER BY cnt DESC"
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
     * @param array $data validierte Update-Daten
     * @return array{0:?array,1:?string} [serialisiertes Rezept|null, fehler|null]
     */
    public static function update(int $id, array $data): array
    {
        $exists = Db::one("SELECT `id` FROM `recipes` WHERE `id` = ?", [$id]);
        if ($exists === null) {
            return [null, 'Rezept nicht gefunden'];
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
                $val = $data[$col];
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
                $set[] = '`customIngredients` = ?';
                $args[] = json_encode($ci, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            }
        }

        // updatedAt immer aktualisieren (Prisma @updatedAt-Verhalten)
        $set[] = '`updatedAt` = ?';
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

        return [self::getById($id), null];
    }

    public static function delete(int $id): void
    {
        // ON DELETE CASCADE entfernt zugehörige Zeilen
        Db::run("DELETE FROM `recipes` WHERE `id` = ?", [$id]);
    }
}
