import {
  Search, Plus, BookOpen, Sliders, ChefHat, Edit3, Share2,
  Link2, Copy, Mail, Users, Smartphone, Eye,
} from 'lucide-react';

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
        <Icon className="w-4 h-4 text-brand-500 shrink-0" />
        {title}
      </h2>
      <div className="space-y-3 text-sm text-gray-600 leading-relaxed">{children}</div>
    </section>
  );
}

function Feature({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="pl-4 border-l-2 border-brand-100">
      <p className="font-semibold text-gray-800 mb-0.5">{title}</p>
      <div className="text-gray-500">{children}</div>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">
      {label}
    </span>
  );
}

export default function AnleitungPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center text-white text-2xl font-bold shrink-0">
          R
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Rezeptsammlung</h1>
          <p className="text-sm text-gray-500">Alle Funktionen auf einen Blick</p>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-8">
        Deine persönliche Rezeptsammlung – importiere Rezepte aus dem Internet, passe Portionen
        an, teile Lieblings­rezepte und verwalte alles zentral.
      </p>

      {/* ── Rezepte hinzufügen ──────────────────────────────────────────── */}
      <Section icon={Plus} title="Rezepte hinzufügen">
        <p>
          Über <Chip label="Hinzufügen" /> in der Navigationsleiste gibt es zwei Wege, ein
          Rezept in die Sammlung aufzunehmen.
        </p>
        <Feature title="Per URL importieren">
          Den Tab <Chip label="Per URL importieren" /> wählen, die Adresse einer Rezeptseite
          einfügen und bestätigen. Die App erkennt automatisch Titel, Zutaten,
          Zubereitungsschritte, Kochzeiten, Tags und Nährwerte aus strukturierten Quellen
          (z.&nbsp;B. Chefkoch, GuteKüche, BBC Food und viele mehr).
        </Feature>
        <Feature title={<><Smartphone className="w-3.5 h-3.5 inline mr-1" />Rezept abfotografieren</>}>
          Den Tab <Chip label="Foto" /> wählen, ein Foto des Rezepts aufnehmen oder aus der
          Galerie auswählen und auf <Chip label="Rezept erkennen" /> tippen. Die KI
          (Claude Vision) erkennt Titel, Zutaten und Zubereitungsschritte automatisch und
          füllt das Bearbeitungsformular vor – danach noch einmal kurz prüfen und speichern.
          Funktioniert mit Buchseiten, handgeschriebenen Zetteln und Screenshots.
        </Feature>
        <Feature title="Manuell eingeben">
          Den Tab <Chip label="Manuell eingeben" /> wählen und das Rezept direkt eintippen –
          mit Titel, Beschreibung, Zutaten (Menge, Einheit, Name), Zubereitungsschritten,
          Kochzeiten und Diät-Flags. Ideal für Rezepte aus Büchern oder eigene Kreationen.
        </Feature>
        <Feature title="Direkt vom Smartphone teilen">
          Öffne ein Rezept im Browser und tippe im Teilen-Menü auf <Chip label="Rezept speichern" />{' '}
          (iPhone/iPad: iOS-Kurzbefehl, Android: HTTP Shortcuts). Das Rezept landet sofort in
          der Sammlung, ohne dass du die App öffnen musst.
        </Feature>
      </Section>

      {/* ── Suchen & Filtern ─────────────────────────────────────────────── */}
      <Section icon={Search} title="Suchen und Filtern">
        <p>
          Auf der Startseite findest du alle Rezepte in einer durchsuchbaren Übersicht.
        </p>
        <Feature title="Volltextsuche">
          Die Suche durchforstet Titel, Beschreibung, Zutaten und Tags gleichzeitig. Einfach
          den Suchbegriff eingeben – die Ergebnisse aktualisieren sich sofort.
        </Feature>
        <Feature title="Filter">
          Filtere nach Ernährungsweise (<Chip label="Vegetarisch" /> <Chip label="Vegan" />{' '}
          <Chip label="Glutenfrei" />), maximaler Kochzeit oder Tags. Mehrere Filter lassen
          sich kombinieren.
        </Feature>
        <Feature title="Tags">
          Beim Import werden Tags automatisch aus den Rezept-Metadaten übernommen. Über das
          Bearbeiten-Formular können Tags jederzeit angepasst werden.
        </Feature>
      </Section>

      {/* ── Rezeptansicht ─────────────────────────────────────────────────── */}
      <Section icon={BookOpen} title="Rezeptansicht">
        <p>
          Ein Tipp auf eine Rezeptkarte öffnet die Detailansicht mit allen Informationen.
        </p>
        <Feature title="Portionsskalierung">
          Mit dem Schieberegler (<Sliders className="w-3.5 h-3.5 inline" />) über den Zutaten
          lassen sich die Mengenangaben stufenlos auf jede gewünschte Portion­szahl anpassen.
          Die Berechnung erfolgt anteilig – ganze Zutaten ohne Mengenangabe bleiben unverändert.
        </Feature>
        <Feature title="Kochmodus">
          Der <Chip label="Kochmodus" />-Button vergrößert die Schrift deutlich, damit die
          Anleitung beim Kochen auch auf Distanz gut lesbar ist.
        </Feature>
        <Feature title="Angepasste Zutaten">
          Wenn ein Rezept eigene Mengen oder Zutaten hat (z.&nbsp;B. aus dem Bearbeiten-Formular),
          kann über den Umschalter <Chip label="Original" /> / <Chip label="Angepasst" />{' '}
          zwischen beiden Varianten gewechselt werden.
        </Feature>
        <Feature title="Nährwerte">
          Sofern die Quelle Nährwerte enthält, werden sie pro Portion angezeigt
          (Kalorien, Protein, Fett, Kohlenhydrate).
        </Feature>
      </Section>

      {/* ── Rezept bearbeiten ─────────────────────────────────────────────── */}
      <Section icon={Edit3} title="Rezept bearbeiten">
        <p>
          Über den <Chip label="Bearbeiten" />-Button in der Rezeptansicht öffnet sich das
          Bearbeitungsformular.
        </p>
        <Feature title="Stammdaten">
          Titel, Beschreibung, Kochzeiten, Portionsanzahl und Diät-Flags
          (vegetarisch, vegan, glutenfrei, laktosefrei) können frei geändert werden.
        </Feature>
        <Feature title="Tags">
          Tags werden als kommagetrennte Liste eingegeben. Bereits verwendete Tags werden als
          Vorschläge angeboten.
        </Feature>
        <Feature title="Eigene Zutaten">
          Im Abschnitt „Eigene Zutaten" lassen sich alternative Mengenangaben hinterlegen
          (z.&nbsp;B. für eine bevorzugte Variante). In der Rezeptansicht erscheint dann der
          Umschalter Original / Angepasst.
        </Feature>
        <Feature title="Löschen">
          Das Löschen-Symbol (Papierkorb) in der Rezeptansicht entfernt das Rezept nach einer
          Bestätigung dauerhaft aus der Sammlung.
        </Feature>
      </Section>

      {/* ── Rezepte teilen ─────────────────────────────────────────────────── */}
      <Section icon={Share2} title="Rezepte teilen">
        <p>
          Über den <Chip label="Teilen" />-Button (<Share2 className="w-3.5 h-3.5 inline" />)
          in der Rezeptansicht gibt es zwei Möglichkeiten, ein Rezept weiterzugeben. Das
          Teilen-Menü ist nur für den Besitzer des Rezepts sichtbar.
        </p>

        <Feature title={<><Copy className="w-3.5 h-3.5 inline mr-1" />Kopier-Link</>}>
          Erstellt einen einmaligen Link. Wer diesen Link öffnet, sieht eine Vorschau des Rezepts
          und kann es mit einem Tipp in die <em>eigene</em> Sammlung kopieren – die beiden
          Rezepte sind danach völlig unabhängig voneinander. Auch ein Login ist für die Vorschau
          nicht nötig.
        </Feature>

        <Feature title={<><Mail className="w-3.5 h-3.5 inline mr-1" />Direkte Freigabe</>}>
          Teilt das Rezept dauerhaft mit einem anderen Nutzer. Das Rezept bleibt eines – beide
          sehen dasselbe. Die Berechtigung wählen:
          <ul className="mt-1 ml-4 space-y-1 list-disc">
            <li><Eye className="w-3 h-3 inline mr-1" /><strong>Nur ansehen</strong> – der andere Nutzer sieht das Rezept, kann es aber nicht ändern.</li>
            <li><Edit3 className="w-3 h-3 inline mr-1" /><strong>Ansehen &amp; bearbeiten</strong> – Änderungen beider Nutzer sind sofort für alle sichtbar.</li>
          </ul>
          Bestehende Freigaben werden im selben Dialog angezeigt und können dort entfernt werden.
        </Feature>
      </Section>

      {/* ── Konten verknüpfen ─────────────────────────────────────────────── */}
      <Section icon={Link2} title="Konten verknüpfen">
        <p>
          Unter <Chip label="Profil" /> (Tipp auf das Profilfoto oben rechts) gibt es den
          Bereich <strong>„Verknüpfte Konten"</strong>.
        </p>
        <Feature title="Was bewirkt eine Verknüpfung?">
          Nach der Verknüpfung zweier Konten sieht jeder Nutzer automatisch alle Rezepte des
          anderen in seiner Sammlung – als wären es eigene. Rezepte des verknüpften Kontos sind
          in der Übersicht mit dem Namen des Besitzers gekennzeichnet.
        </Feature>
        <Feature title="Verknüpfung einrichten">
          Die E-Mail-Adresse des anderen Nutzers eingeben und auf <Chip label="Anfragen" />{' '}
          tippen. Der andere Nutzer muss die Anfrage im eigenen Profil <em>annehmen</em> – erst
          dann wird die Verknüpfung aktiv.
        </Feature>
        <Feature title="Offene Anfragen">
          Eingehende Anfragen werden mit einem roten Zähler auf dem Profilfoto signalisiert.
          Im Profil können sie angenommen oder abgelehnt werden.
        </Feature>
        <Feature title="Berechtigung">
          Über verknüpfte Konten sichtbare Rezepte sind grundsätzlich <em>nur lesbar</em>. Wer
          Bearbeitungsrecht benötigt, nutzt die direkte Rezept-Freigabe (siehe oben).
        </Feature>
        <Feature title="Verknüpfung aufheben">
          Im Profil das Papierkorb-Symbol neben der Verknüpfung antippen. Danach sind die
          Rezepte des anderen Nutzers wieder ausgeblendet.
        </Feature>
      </Section>

      {/* ── Profil & Abmelden ──────────────────────────────────────────────── */}
      <Section icon={Users} title="Profil &amp; Abmelden">
        <p>
          Ein Tipp auf das Profilfoto oben rechts öffnet die Profilseite.
        </p>
        <Feature title="Profilseite">
          Zeigt Namen und E-Mail-Adresse des aktuellen Kontos sowie alle Kontoverbindungen.
          Über die Schaltfläche <Chip label="Abmelden" /> wird die Sitzung beendet.
        </Feature>
        <Feature title="Anmeldung">
          Die Anmeldung erfolgt ausschließlich über Google OAuth. Kein separates Passwort nötig –
          einfach das Google-Konto verwenden.
        </Feature>
      </Section>

      {/* ── Smartphone-Integration ─────────────────────────────────────────── */}
      <Section icon={Smartphone} title="Smartphone-Integration (optional)">
        <p>
          Mit einem eingerichteten Kurzbefehl (iOS/iPadOS) bzw. einem HTTP-Shortcut (Android)
          lässt sich jedes Rezept direkt aus dem Browser-Teilen-Menü speichern, ohne die App
          öffnen zu müssen.
        </p>
        <Feature title="iPhone &amp; iPad – iOS-Kurzbefehle">
          <ol className="mt-1 ml-4 space-y-1 list-decimal">
            <li>Kurzbefehle-App öffnen → neuen Kurzbefehl anlegen.</li>
            <li>Aktion 1: „Eingabe aus Teilen-Menü empfangen" (Typ: URLs).</li>
            <li>Aktion 2: „Web-Anfrage" – Methode POST, URL{' '}
              <code className="font-mono text-xs bg-gray-100 px-1 rounded">
                https://rezepte.familie-ebert.net/api/import
              </code>
              , Header <code className="font-mono text-xs bg-gray-100 px-1 rounded">x-api-key</code>{' '}
              mit deinem API-Schlüssel, JSON-Body mit Schlüssel{' '}
              <code className="font-mono text-xs bg-gray-100 px-1 rounded">url</code>{' '}
              und der Eingabe-Variable aus Schritt 1.
            </li>
            <li>Aktion 3 (optional): „Mitteilung anzeigen" → „Rezept gespeichert ✓".</li>
            <li>Kurzbefehl benennen und im Teilen-Menü aktivieren.</li>
          </ol>
        </Feature>
        <Feature title="Android – HTTP Shortcuts">
          <ol className="mt-1 ml-4 space-y-1 list-decimal">
            <li>App „HTTP Shortcuts" (kostenlos, Waboodoo) aus dem Play Store installieren.</li>
            <li>Neuen Shortcut anlegen: POST,{' '}
              <code className="font-mono text-xs bg-gray-100 px-1 rounded">
                https://rezepte.familie-ebert.net/api/import
              </code>
            </li>
            <li>Header: <code className="font-mono text-xs bg-gray-100 px-1 rounded">Content-Type: application/json</code> und{' '}
              <code className="font-mono text-xs bg-gray-100 px-1 rounded">x-api-key: &lt;dein-schlüssel&gt;</code>.
            </li>
            <li>Body (Custom Text):{' '}
              <code className="font-mono text-xs bg-gray-100 px-1 rounded">{'{"url":"{share_text}"}'}</code>
            </li>
            <li>Im Teilen-Menü aktivieren und speichern.</li>
          </ol>
        </Feature>
      </Section>

    </div>
  );
}
