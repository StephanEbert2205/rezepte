<?php
declare(strict_types=1);

/** Eingabevalidierung – spiegelt die zod-Schemata der Express-Routen. */
final class Validator
{
    /** @return array{0:?array,1:?string} [validierte Daten, Fehlermeldung] */
    public static function importBody($body): array
    {
        if (!is_array($body) || !isset($body['url']) || !is_string($body['url'])) {
            return [null, 'Bitte eine gültige URL eingeben'];
        }
        $url = $body['url'];
        if (filter_var($url, FILTER_VALIDATE_URL) === false) {
            return [null, 'Bitte eine gültige URL eingeben'];
        }
        return [['url' => $url], null];
    }

    /** @return array{0:?array,1:?string} */
    public static function updateBody($body): array
    {
        if (!is_array($body)) {
            return [null, 'Ungültige Daten'];
        }
        $data = [];

        // Reihenfolge wie im zod-Schema (für "erste Fehlermeldung")
        if (array_key_exists('title', $body)) {
            $v = $body['title'];
            if (!is_string($v)) return [null, 'title muss ein Text sein'];
            $len = mb_strlen($v);
            if ($len < 1) return [null, 'title darf nicht leer sein'];
            if ($len > 500) return [null, 'title ist zu lang (max. 500 Zeichen)'];
            $data['title'] = $v;
        }
        if (array_key_exists('description', $body)) {
            $v = $body['description'];
            if (!is_string($v)) return [null, 'description muss ein Text sein'];
            $data['description'] = $v;
        }
        foreach (['servingsOriginal' => true, 'prepTime' => false, 'cookTime' => false, 'totalTime' => false] as $field => $positive) {
            if (array_key_exists($field, $body)) {
                $v = $body[$field];
                if (!is_int($v)) return [null, "$field muss eine ganze Zahl sein"];
                if ($positive && $v <= 0) return [null, "$field muss größer als 0 sein"];
                if (!$positive && $v < 0) return [null, "$field darf nicht negativ sein"];
                $data[$field] = $v;
            }
        }
        if (array_key_exists('imageUrl', $body)) {
            $v = $body['imageUrl'];
            if (!is_string($v)) return [null, 'imageUrl muss ein Text sein'];
            if ($v !== '' && filter_var($v, FILTER_VALIDATE_URL) === false) {
                return [null, 'imageUrl muss eine gültige URL sein'];
            }
            $data['imageUrl'] = $v;
        }
        foreach (['isVegetarian', 'isVegan', 'isGlutenFree', 'isLactoseFree'] as $field) {
            if (array_key_exists($field, $body)) {
                $v = $body[$field];
                if (!is_bool($v)) return [null, "$field muss true oder false sein"];
                $data[$field] = $v;
            }
        }
        if (array_key_exists('tags', $body)) {
            $v = $body['tags'];
            if (!is_array($v) || !array_is_list($v)) return [null, 'tags muss eine Liste sein'];
            foreach ($v as $t) {
                if (!is_string($t)) return [null, 'tags muss Texte enthalten'];
            }
            $data['tags'] = $v;
        }
        if (array_key_exists('customIngredients', $body)) {
            $v = $body['customIngredients'];
            if ($v === null) {
                $data['customIngredients'] = null;
            } elseif (is_array($v) && array_is_list($v)) {
                foreach ($v as $ci) {
                    if (!is_array($ci)) return [null, 'customIngredients hat ein ungültiges Element'];
                    if (!isset($ci['name']) || !is_string($ci['name']) || mb_strlen($ci['name']) < 1 || mb_strlen($ci['name']) > 500) {
                        return [null, 'customIngredients: name ist ungültig'];
                    }
                    foreach (['amount' => 100, 'unit' => 50, 'notes' => 500] as $f => $max) {
                        if (!isset($ci[$f]) || !is_string($ci[$f]) || mb_strlen($ci[$f]) > $max) {
                            return [null, "customIngredients: $f ist ungültig"];
                        }
                    }
                    if (!isset($ci['optional']) || !is_bool($ci['optional'])) {
                        return [null, 'customIngredients: optional ist ungültig'];
                    }
                }
                $data['customIngredients'] = $v;
            } else {
                return [null, 'customIngredients muss eine Liste oder null sein'];
            }
        }

        return [$data, null];
    }
}
