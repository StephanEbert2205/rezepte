<?php
declare(strict_types=1);

/** Portierung von backend/src/services/ImportService.ts */
final class Importer
{
    /**
     * @throws RuntimeException  Bei "DUPLICATE:{id}" oder Validierungs-/Fetch-Fehlern.
     */
    public static function fromUrl(string $url, array $cfg): int
    {
        Fetch::validatePublicUrl($url);

        $existing = Db::one("SELECT `id` FROM `recipes` WHERE `sourceUrl` = ?", [$url]);
        if ($existing !== null) {
            throw new RuntimeException('DUPLICATE:' . (int) $existing['id']);
        }

        $html   = Fetch::html($url, $cfg['fetchTimeout'], $cfg['maxResponseSize']);
        $parsed = JsonLd::parse($html, $url);

        return self::save($parsed);
    }

    private static function save(array $parsed): int
    {
        $servings   = $parsed['servings'] ?? 4;
        $servings   = (int) $servings > 0 ? (int) $servings : 4;
        $ingredients = $parsed['ingredients'] ?? [];
        $normalized = Normalize::ingredients($ingredients, $servings);
        $now = gmdate('Y-m-d H:i:s');

        Db::begin();
        try {
            Db::run(
                "INSERT INTO `recipes`
                    (`title`, `description`, `sourceUrl`, `sourceDomain`, `servingsOriginal`,
                     `servingsBase`, `prepTime`, `cookTime`, `totalTime`, `imageUrl`, `author`,
                     `isVegetarian`, `isVegan`, `isGlutenFree`, `isLactoseFree`,
                     `createdAt`, `updatedAt`)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?)",
                [
                    $parsed['title'] ?? 'Unbekanntes Rezept',
                    $parsed['description'] ?? null,
                    $parsed['sourceUrl'] ?? null,
                    $parsed['sourceDomain'] ?? null,
                    $parsed['servings'] ?? null,
                    $servings,
                    $parsed['prepTime'] ?? null,
                    $parsed['cookTime'] ?? null,
                    $parsed['totalTime'] ?? null,
                    $parsed['imageUrl'] ?? null,
                    $parsed['author'] ?? null,
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
            foreach ($ingredients as $idx => $ing) {
                $n = $normalized[$idx];
                $insIng->execute([
                    $recipeId,
                    $ing['name'] ?? '',
                    $n['normalizedName'],
                    $ing['amountOriginal'] ?? null,
                    $ing['unitOriginal'] ?? null,
                    $n['amountPerServing'],
                    $n['unitNormalized'],
                    !empty($ing['optional']) ? 1 : 0,
                    $ing['notes'] ?? null,
                    $idx,
                ]);
            }

            $insStep = Db::pdo()->prepare(
                "INSERT INTO `instructions` (`recipeId`, `stepNumber`, `content`) VALUES (?, ?, ?)"
            );
            foreach (($parsed['instructions'] ?? []) as $inst) {
                $insStep->execute([$recipeId, $inst['stepNumber'], $inst['content']]);
            }

            $nutrition = $parsed['nutrition'] ?? null;
            if (is_array($nutrition)) {
                Db::run(
                    "INSERT INTO `nutrition`
                        (`recipeId`, `calories`, `protein`, `fat`, `carbs`, `fiber`, `sugar`)
                     VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [
                        $recipeId,
                        $nutrition['calories'] ?? null,
                        $nutrition['protein'] ?? null,
                        $nutrition['fat'] ?? null,
                        $nutrition['carbs'] ?? null,
                        $nutrition['fiber'] ?? null,
                        $nutrition['sugar'] ?? null,
                    ]
                );
            }

            foreach (($parsed['tags'] ?? []) as $tagName) {
                $tagId = Recipes::upsertTag((string) $tagName);
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
}
