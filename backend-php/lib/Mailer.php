<?php
declare(strict_types=1);

/**
 * Einfacher E-Mail-Versand via PHP mail().
 * Funktioniert auf all-inkl.com ohne SMTP-Konfiguration.
 */
final class Mailer
{
    /**
     * Sendet eine Einladungs-E-Mail an eine noch nicht registrierte E-Mail-Adresse.
     *
     * @param string $toEmail     Empfänger-Adresse
     * @param string $inviterName Name des einladenden Nutzers
     * @param string $token       64-stelliges Hex-Token
     * @param string $frontendUrl Basis-URL des Frontends (z. B. https://rezepte.familie-ebert.net)
     * @param string $fromEmail   Absender-Adresse (aus Config)
     * @throws RuntimeException   Wenn mail() fehlschlägt
     */
    public static function sendInvitation(
        string $toEmail,
        string $inviterName,
        string $token,
        string $frontendUrl,
        string $fromEmail
    ): void {
        $inviteUrl = rtrim($frontendUrl, '/') . '/einladung/' . rawurlencode($token);
        $subject   = '=?UTF-8?B?' . base64_encode("Einladung zur Rezeptsammlung von $inviterName") . '?=';

        $body = self::buildBody($inviterName, $inviteUrl);

        $headers = implode("\r\n", [
            "From: Rezeptsammlung <$fromEmail>",
            "Reply-To: $fromEmail",
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
            'X-Mailer: Rezeptsammlung/PHP',
        ]);

        $sent = mail($toEmail, $subject, $body, $headers);
        if (!$sent) {
            throw new RuntimeException('E-Mail konnte nicht gesendet werden – bitte Mailkonfiguration prüfen');
        }
    }

    // ── Hilfsmethoden ────────────────────────────────────────────────────────

    private static function buildBody(string $inviterName, string $inviteUrl): string
    {
        return <<<TEXT
Hallo,

{$inviterName} möchte die Rezeptsammlung mit dir teilen und hat dich
eingeladen, der App beizutreten.

Mit der Rezeptsammlung kannst du:
  • Rezepte aus dem Internet importieren
  • Rezepte abfotografieren und automatisch erkennen lassen
  • Portionen anpassen und im Kochmodus kochen
  • Rezepte mit anderen teilen oder Konten verknüpfen

Klicke auf den folgenden Link, um die Einladung anzunehmen
(gültig für 48 Stunden):

  {$inviteUrl}

Falls du diese Einladung nicht erwartet hast, kannst du diese E-Mail
einfach ignorieren.

Viele Grüße
Deine Rezeptsammlung
TEXT;
    }
}
