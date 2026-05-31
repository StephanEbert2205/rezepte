<?php
declare(strict_types=1);

/** Portierung von backend/src/parsers/TimeParser.ts */
final class TimeParser
{
    /** ISO-8601-Dauer (P..DT..H..M..S) → Minuten oder null. */
    public static function iso8601(?string $duration): ?int
    {
        if ($duration === null || $duration === '') {
            return null;
        }
        if (!preg_match('/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i', $duration, $m)) {
            return null;
        }
        $days    = isset($m[1]) && $m[1] !== '' ? (int) $m[1] : 0;
        $hours   = isset($m[2]) && $m[2] !== '' ? (int) $m[2] : 0;
        $minutes = isset($m[3]) && $m[3] !== '' ? (int) $m[3] : 0;
        $total   = $days * 1440 + $hours * 60 + $minutes;
        return $total > 0 ? $total : null;
    }

    /** Freitext wie "1 Stunde 30 Minuten" → Minuten oder null. */
    public static function human(?string $text): ?int
    {
        if ($text === null || $text === '') {
            return null;
        }
        $lower = mb_strtolower($text);
        $total = 0;
        if (preg_match('/(\d+)\s*(?:stunde|stunden|std\.?|h)/u', $lower, $h)) {
            $total += (int) $h[1] * 60;
        }
        if (preg_match('/(\d+)\s*(?:minute|minuten|min\.?|m)/u', $lower, $mm)) {
            $total += (int) $mm[1];
        }
        return $total > 0 ? $total : null;
    }
}
