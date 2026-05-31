<?php
declare(strict_types=1);

/**
 * Rezept-Freigaben:
 *  - Share-Link (Token)  → Empfänger erhält eine eigene Kopie des Rezepts
 *  - Direkte Freigabe    → Empfänger sieht/bearbeitet dasselbe Rezept
 */
final class Sharing
{
    // ── Share-Token (Kopie per Link) ────────────────────────────────────────

    /**
     * Erzeugt einen Freigabe-Link für ein Rezept.
     * Gibt {token} zurück; Frontend baut daraus die URL.
     * @throws RuntimeException wenn der aktuelle User das Rezept nicht besitzt
     */
    public static function createToken(int $recipeId, int $userId): array
    {
        $recipe = Db::one(
            "SELECT `id`, `title` FROM `recipes` WHERE `id` = ? AND `userId` = ?",
            [$recipeId, $userId]
        );
        if ($recipe === null) {
            throw new RuntimeException('Rezept nicht gefunden oder keine Berechtigung');
        }

        // Vorhandene Tokens für dieses Rezept löschen und neuen anlegen
        Db::run(
            "DELETE FROM `recipe_share_tokens` WHERE `recipeId` = ? AND `userId` = ?",
            [$recipeId, $userId]
        );

        $token = bin2hex(random_bytes(32)); // 64 Hex-Zeichen
        Db::run(
            "INSERT INTO `recipe_share_tokens` (`recipeId`, `userId`, `token`, `createdAt`)
             VALUES (?, ?, ?, ?)",
            [$recipeId, $userId, $token, gmdate('Y-m-d H:i:s')]
        );

        return ['token' => $token];
    }

    /**
     * Liefert Rezept-Daten für einen Token (ohne Anmeldung nutzbar).
     * @return array|null  null wenn Token unbekannt oder abgelaufen
     */
    public static function getRecipeByToken(string $token): ?array
    {
        $row = Db::one(
            "SELECT `recipeId` FROM `recipe_share_tokens`
             WHERE `token` = ? AND (`expiresAt` IS NULL OR `expiresAt` > NOW())",
            [$token]
        );
        if ($row === null) {
            return null;
        }
        return Recipes::getByIdRaw((int) $row['recipeId']);
    }

    /**
     * Kopiert ein geteiltes Rezept in die Sammlung des Ziel-Nutzers.
     * @throws RuntimeException bei ungültigem Token oder DB-Fehler
     */
    public static function forkByToken(string $token, int $targetUserId): int
    {
        $row = Db::one(
            "SELECT `recipeId` FROM `recipe_share_tokens`
             WHERE `token` = ? AND (`expiresAt` IS NULL OR `expiresAt` > NOW())",
            [$token]
        );
        if ($row === null) {
            throw new RuntimeException('Ungültiger oder abgelaufener Freigabelink');
        }

        $sourceId = (int) $row['recipeId'];
        return self::copyRecipeTo($sourceId, $targetUserId);
    }

    /** Kopiert ein Rezept (inkl. aller Relationen) zu einem anderen Nutzer. */
    private static function copyRecipeTo(int $sourceId, int $userId): int
    {
        $now = gmdate('Y-m-d H:i:s');

        Db::begin();
        try {
            // Rezept kopieren (sourceUrl auf NULL setzen – der User hat eine eigene Kopie)
            Db::run(
                "INSERT INTO `recipes`
                    (`userId`, `title`, `description`, `sourceUrl`, `sourceDomain`,
                     `servingsOriginal`, `servingsBase`, `prepTime`, `cookTime`, `totalTime`,
                     `imageUrl`, `author`, `isVegetarian`, `isVegan`, `isGlutenFree`,
                     `isLactoseFree`, `customIngredients`, `createdAt`, `updatedAt`)
                 SELECT ?, `title`, `description`, NULL, `sourceDomain`,
                        `servingsOriginal`, `servingsBase`, `prepTime`, `cookTime`, `totalTime`,
                        `imageUrl`, `author`, `isVegetarian`, `isVegan`, `isGlutenFree`,
                        `isLactoseFree`, `customIngredients`, ?, ?
                 FROM `recipes` WHERE `id` = ?",
                [$userId, $now, $now, $sourceId]
            );
            $newId = Db::lastId();

            // Zutaten kopieren
            $ings = Db::all(
                "SELECT * FROM `ingredients` WHERE `recipeId` = ? ORDER BY `sortOrder`",
                [$sourceId]
            );
            $stmtIng = Db::pdo()->prepare(
                "INSERT INTO `ingredients`
                    (`recipeId`, `name`, `normalizedName`, `amountOriginal`, `unitOriginal`,
                     `amountPerServing`, `unitNormalized`, `optional`, `notes`, `sortOrder`)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            foreach ($ings as $ing) {
                $stmtIng->execute([
                    $newId, $ing['name'], $ing['normalizedName'], $ing['amountOriginal'],
                    $ing['unitOriginal'], $ing['amountPerServing'], $ing['unitNormalized'],
                    $ing['optional'], $ing['notes'], $ing['sortOrder'],
                ]);
            }

            // Zubereitungsschritte kopieren
            $steps = Db::all(
                "SELECT * FROM `instructions` WHERE `recipeId` = ? ORDER BY `stepNumber`",
                [$sourceId]
            );
            $stmtStep = Db::pdo()->prepare(
                "INSERT INTO `instructions` (`recipeId`, `stepNumber`, `content`) VALUES (?, ?, ?)"
            );
            foreach ($steps as $step) {
                $stmtStep->execute([$newId, $step['stepNumber'], $step['content']]);
            }

            // Nährwerte kopieren
            $nut = Db::one("SELECT * FROM `nutrition` WHERE `recipeId` = ?", [$sourceId]);
            if ($nut !== null) {
                Db::run(
                    "INSERT INTO `nutrition`
                        (`recipeId`, `calories`, `protein`, `fat`, `carbs`, `fiber`, `sugar`)
                     VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [$newId, $nut['calories'], $nut['protein'], $nut['fat'],
                     $nut['carbs'], $nut['fiber'], $nut['sugar']]
                );
            }

            // Tags kopieren
            $rtags = Db::all(
                "SELECT `tagId` FROM `recipe_tags` WHERE `recipeId` = ?",
                [$sourceId]
            );
            foreach ($rtags as $rt) {
                Db::run(
                    "INSERT IGNORE INTO `recipe_tags` (`recipeId`, `tagId`) VALUES (?, ?)",
                    [$newId, $rt['tagId']]
                );
            }

            Db::commit();
            return $newId;
        } catch (Throwable $e) {
            Db::rollback();
            throw $e;
        }
    }

    // ── Direkte Freigaben ────────────────────────────────────────────────────

    /**
     * Teilt ein Rezept direkt mit einem anderen Nutzer (per E-Mail).
     * @throws RuntimeException bei fehlender Berechtigung oder unbekannter E-Mail
     */
    public static function shareWithUser(
        int    $recipeId,
        int    $ownerId,
        string $email,
        bool   $canEdit
    ): array {
        $recipe = Db::one(
            "SELECT `id` FROM `recipes` WHERE `id` = ? AND `userId` = ?",
            [$recipeId, $ownerId]
        );
        if ($recipe === null) {
            throw new RuntimeException('Rezept nicht gefunden oder keine Berechtigung');
        }

        $targetUser = Db::one(
            "SELECT `id`, `name`, `email`, `picture` FROM `users` WHERE `email` = ?",
            [$email]
        );
        if ($targetUser === null) {
            throw new RuntimeException('Kein Konto mit dieser E-Mail-Adresse gefunden');
        }

        $targetId = (int) $targetUser['id'];
        if ($targetId === $ownerId) {
            throw new RuntimeException('Du kannst das Rezept nicht mit dir selbst teilen');
        }

        $now = gmdate('Y-m-d H:i:s');
        Db::run(
            "INSERT INTO `recipe_shares`
                (`recipeId`, `ownerId`, `sharedWithId`, `canEdit`, `createdAt`)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE `canEdit` = VALUES(`canEdit`)",
            [$recipeId, $ownerId, $targetId, $canEdit ? 1 : 0, $now]
        );

        return [
            'recipeId'   => $recipeId,
            'canEdit'    => $canEdit,
            'sharedWith' => [
                'id'      => $targetId,
                'name'    => $targetUser['name'],
                'email'   => $targetUser['email'],
                'picture' => $targetUser['picture'],
            ],
        ];
    }

    /**
     * Alle direkten Freigaben eines Rezepts (nur für den Besitzer sichtbar).
     * @throws RuntimeException wenn der User das Rezept nicht besitzt
     */
    public static function getSharesForRecipe(int $recipeId, int $ownerId): array
    {
        $recipe = Db::one(
            "SELECT `id` FROM `recipes` WHERE `id` = ? AND `userId` = ?",
            [$recipeId, $ownerId]
        );
        if ($recipe === null) {
            throw new RuntimeException('Rezept nicht gefunden oder keine Berechtigung');
        }

        $rows = Db::all(
            "SELECT rs.`id`, rs.`canEdit`,
                    u.`id` AS uid, u.`name`, u.`email`, u.`picture`
             FROM `recipe_shares` rs
             JOIN `users` u ON u.`id` = rs.`sharedWithId`
             WHERE rs.`recipeId` = ?
             ORDER BY rs.`createdAt` ASC",
            [$recipeId]
        );

        return array_map(static fn($r) => [
            'id'         => (int) $r['id'],
            'recipeId'   => $recipeId,
            'canEdit'    => (bool) (int) $r['canEdit'],
            'sharedWith' => [
                'id'      => (int) $r['uid'],
                'name'    => $r['name'],
                'email'   => $r['email'],
                'picture' => $r['picture'],
            ],
        ], $rows);
    }

    /**
     * Entfernt eine direkte Freigabe.
     * @throws RuntimeException wenn der User das Rezept nicht besitzt
     */
    public static function removeShare(int $recipeId, int $ownerId, int $sharedWithId): void
    {
        $recipe = Db::one(
            "SELECT `id` FROM `recipes` WHERE `id` = ? AND `userId` = ?",
            [$recipeId, $ownerId]
        );
        if ($recipe === null) {
            throw new RuntimeException('Rezept nicht gefunden oder keine Berechtigung');
        }
        Db::run(
            "DELETE FROM `recipe_shares` WHERE `recipeId` = ? AND `sharedWithId` = ?",
            [$recipeId, $sharedWithId]
        );
    }
}
