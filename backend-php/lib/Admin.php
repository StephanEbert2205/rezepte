<?php
declare(strict_types=1);

/**
 * Admin-Datenzugriff – nur über Auth::requireAdmin() geschützte Routen nutzbar.
 */
final class Admin
{
    // ── Gesamtstatistik ──────────────────────────────────────────────────────

    public static function getStats(): array
    {
        $users       = (int) (Db::one("SELECT COUNT(*) AS c FROM `users`")['c'] ?? 0);
        $recipes     = (int) (Db::one("SELECT COUNT(*) AS c FROM `recipes`")['c'] ?? 0);
        $ingredients = (int) (Db::one("SELECT COUNT(*) AS c FROM `ingredients`")['c'] ?? 0);
        $links       = (int) (Db::one("SELECT COUNT(*) AS c FROM `account_links` WHERE `status` = 'accepted'")['c'] ?? 0);
        $pendingLinks = (int) (Db::one("SELECT COUNT(*) AS c FROM `account_links` WHERE `status` = 'pending'")['c'] ?? 0);

        // account_invitations kann fehlen wenn Migration noch nicht lief
        $invitations = 0;
        try {
            $invitations = (int) (Db::one("SELECT COUNT(*) AS c FROM `account_invitations`")['c'] ?? 0);
        } catch (Throwable) {}

        // Offene Meldungen (Tabelle kann fehlen wenn Migration noch nicht lief)
        $openReports = 0;
        try {
            $openReports = Reports::countOpen();
        } catch (Throwable) {}

        $sources = Db::all(
            "SELECT `sourceDomain`, COUNT(*) AS cnt
             FROM `recipes`
             WHERE `sourceDomain` IS NOT NULL AND `sourceDomain` != ''
             GROUP BY `sourceDomain`
             ORDER BY cnt DESC
             LIMIT 10"
        );

        return [
            'users'        => $users,
            'recipes'      => $recipes,
            'ingredients'  => $ingredients,
            'activeLinks'  => $links,
            'pendingLinks' => $pendingLinks,
            'invitations'  => $invitations,
            'openReports'  => $openReports,
            'topSources'   => array_map(
                static fn($r) => ['domain' => $r['sourceDomain'], 'count' => (int) $r['cnt']],
                $sources
            ),
        ];
    }

    // ── Nutzerliste ──────────────────────────────────────────────────────────

    public static function getUsers(): array
    {
        $rows = Db::all(
            "SELECT
                u.`id`, u.`name`, u.`email`, u.`picture`,
                COALESCE(u.`isAdmin`, 0)  AS `isAdmin`,
                u.`createdAt`,
                COUNT(DISTINCT r.`id`)    AS `recipeCount`,
                MAX(r.`createdAt`)        AS `lastRecipeAt`
             FROM `users` u
             LEFT JOIN `recipes` r ON r.`userId` = u.`id`
             GROUP BY u.`id`
             ORDER BY u.`createdAt` DESC"
        );

        return array_map(static fn($r) => [
            'id'           => (int) $r['id'],
            'name'         => $r['name'],
            'email'        => $r['email'],
            'picture'      => $r['picture'],
            'isAdmin'      => (bool) (int) $r['isAdmin'],
            'createdAt'    => $r['createdAt'],
            'recipeCount'  => (int) $r['recipeCount'],
            'lastRecipeAt' => $r['lastRecipeAt'],
        ], $rows);
    }

    // ── Admin-Flag toggeln ───────────────────────────────────────────────────

    public static function toggleAdmin(int $targetId, int $requesterId): array
    {
        if ($targetId === $requesterId) {
            throw new RuntimeException('Du kannst deine eigenen Admin-Rechte nicht ändern');
        }
        $user = Db::one(
            "SELECT `id`, `name`, `email`, COALESCE(`isAdmin`, 0) AS `isAdmin` FROM `users` WHERE `id` = ?",
            [$targetId]
        );
        if ($user === null) {
            throw new RuntimeException('Nutzer nicht gefunden');
        }
        $newFlag = ((int) $user['isAdmin']) === 0 ? 1 : 0;
        Db::run("UPDATE `users` SET `isAdmin` = ? WHERE `id` = ?", [$newFlag, $targetId]);
        return ['id' => $targetId, 'isAdmin' => (bool) $newFlag];
    }

    // ── Alle Rezepte ─────────────────────────────────────────────────────────

    public static function listRecipes(array $params): array
    {
        $search = isset($params['search']) && $params['search'] !== ''
            ? '%' . $params['search'] . '%'
            : null;
        $userId = isset($params['userId']) && $params['userId'] > 0
            ? (int) $params['userId']
            : null;
        $page  = max(1, (int) ($params['page'] ?? 1));
        $limit = min(50, max(10, (int) ($params['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        $where  = [];
        $binds  = [];

        if ($search !== null) {
            $where[] = '(r.`title` LIKE ? OR r.`sourceDomain` LIKE ?)';
            $binds[] = $search;
            $binds[] = $search;
        }
        if ($userId !== null) {
            $where[] = 'r.`userId` = ?';
            $binds[] = $userId;
        }

        $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        $total = (int) (Db::one(
            "SELECT COUNT(*) AS c FROM `recipes` r $whereClause",
            $binds
        )['c'] ?? 0);

        $rows = Db::all(
            "SELECT
                r.`id`, r.`title`, r.`sourceDomain`, r.`imageUrl`,
                r.`createdAt`, r.`servingsOriginal`,
                r.`isVegetarian`, r.`isVegan`, r.`isGlutenFree`,
                u.`id`    AS uid,
                u.`name`  AS uname,
                u.`email` AS uemail,
                (SELECT COUNT(*) FROM `ingredients` i WHERE i.`recipeId` = r.`id`) AS ingCount
             FROM `recipes` r
             LEFT JOIN `users` u ON u.`id` = r.`userId`
             $whereClause
             ORDER BY r.`createdAt` DESC
             LIMIT $limit OFFSET $offset",
            $binds
        );

        $recipes = array_map(static fn($r) => [
            'id'           => (int) $r['id'],
            'title'        => $r['title'],
            'sourceDomain' => $r['sourceDomain'],
            'imageUrl'     => $r['imageUrl'],
            'createdAt'    => $r['createdAt'],
            'servings'     => $r['servingsOriginal'],
            'isVegetarian' => (bool)(int)$r['isVegetarian'],
            'isVegan'      => (bool)(int)$r['isVegan'],
            'isGlutenFree' => (bool)(int)$r['isGlutenFree'],
            'ingredientCount' => (int)$r['ingCount'],
            'owner' => [
                'id'    => $r['uid']    !== null ? (int)$r['uid'] : null,
                'name'  => $r['uname']  ?? '–',
                'email' => $r['uemail'] ?? '–',
            ],
        ], $rows);

        return [
            'recipes' => $recipes,
            'total'   => $total,
            'page'    => $page,
            'limit'   => $limit,
            'pages'   => (int) ceil($total / $limit),
        ];
    }

    // ── Alle Kontoverbindungen ────────────────────────────────────────────────

    public static function getLinks(): array
    {
        $links = Db::all(
            "SELECT
                al.`id`, al.`status`, al.`createdAt`,
                ur.`id`    AS rid, ur.`name`  AS rname, ur.`email` AS remail,
                ua.`id`    AS aid, ua.`name`  AS aname, ua.`email` AS aemail
             FROM `account_links` al
             JOIN `users` ur ON ur.`id` = al.`requesterId`
             JOIN `users` ua ON ua.`id` = al.`accepterId`
             ORDER BY al.`createdAt` DESC"
        );

        // Einladungen (optional – Tabelle könnte fehlen)
        $invitations = [];
        try {
            $invitations = Db::all(
                "SELECT
                    ai.`id`, ai.`email`, ai.`expiresAt`, ai.`createdAt`,
                    u.`name` AS inviterName, u.`email` AS inviterEmail
                 FROM `account_invitations` ai
                 JOIN `users` u ON u.`id` = ai.`inviterId`
                 ORDER BY ai.`createdAt` DESC"
            );
        } catch (Throwable) {}

        return [
            'links' => array_map(static fn($r) => [
                'id'        => (int) $r['id'],
                'status'    => $r['status'],
                'createdAt' => $r['createdAt'],
                'requester' => ['id' => (int)$r['rid'], 'name' => $r['rname'], 'email' => $r['remail']],
                'accepter'  => ['id' => (int)$r['aid'], 'name' => $r['aname'], 'email' => $r['aemail']],
            ], $links),
            'invitations' => array_map(static fn($r) => [
                'id'          => (int) $r['id'],
                'email'       => $r['email'],
                'expiresAt'   => $r['expiresAt'],
                'createdAt'   => $r['createdAt'],
                'inviterName' => $r['inviterName'],
                'inviterEmail'=> $r['inviterEmail'],
            ], $invitations),
        ];
    }
}
