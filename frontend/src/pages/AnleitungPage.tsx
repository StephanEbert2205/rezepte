import { useState } from 'react';

type Tab = 'ios' | 'android' | 'verwendung' | 'faq';

function Badge({ n, green }: { n: number; green?: boolean }) {
  return (
    <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5 ${green ? 'bg-green-600' : 'bg-brand-500'}`}>
      {n}
    </span>
  );
}

function Step({ n, title, children, green }: { n: number; title: React.ReactNode; children: React.ReactNode; green?: boolean }) {
  return (
    <div className="flex gap-3 mb-5">
      <Badge n={n} green={green} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
        <div className="text-sm text-gray-500 space-y-2">{children}</div>
      </div>
    </div>
  );
}

function InfoBox({ children, green }: { children: React.ReactNode; green?: boolean }) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm my-4 ${green ? 'border-green-200 bg-green-50 text-green-900' : 'border-brand-200 bg-brand-50 text-brand-900'}`}>
      {children}
    </div>
  );
}

function SettingsTable({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <table className="w-full text-xs mt-2 mb-1 border border-gray-200 rounded-lg overflow-hidden">
      <tbody>
        {rows.map(([label, value], i) => (
          <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
            <td className="px-3 py-1.5 font-semibold text-gray-500 w-2/5">{label}</td>
            <td className="px-3 py-1.5 font-mono text-gray-800 break-all">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const API_KEY = 'e6a4b700e3855b7e6fdcfcb12013d75fc97b758cdce2f8c2fcbb45f44d6e99eb';
const API_URL = 'https://rezepte.familie-ebert.net/api/import';

export default function AnleitungPage() {
  const [tab, setTab] = useState<Tab>('ios');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'ios',        label: 'iPhone & iPad' },
    { id: 'android',    label: 'Android' },
    { id: 'verwendung', label: 'Verwendung' },
    { id: 'faq',        label: 'FAQ' },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
          R
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Rezeptsammlung</h1>
          <p className="text-sm text-gray-500">Einrichtung auf iPhone, iPad &amp; Android</p>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Diese Anleitung erklärt, wie du mit einem einzigen Tipp ein Rezept aus Safari, Chrome
        oder einem anderen Browser direkt in die Rezeptsammlung speicherst –
        ohne Kopieren, ohne Umwege.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? t.id === 'android'
                  ? 'border-green-600 text-green-700'
                  : 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── iOS ── */}
      {tab === 'ios' && (
        <div>
          <h2 className="text-base font-bold text-brand-600 mb-1">Kurzbefehl einrichten <span className="font-normal text-gray-400 text-sm">(einmalig)</span></h2>
          <p className="text-sm text-gray-500 mb-4">Der Kurzbefehl erscheint danach in jedem Teilen-Menü.</p>

          <Step n={1} title="Kurzbefehle-App öffnen">
            <p>Die App ist auf jedem iPhone und iPad vorinstalliert (oranges Symbol mit weißem Pfeil). Falls sie fehlt: im App Store nach „Kurzbefehle" suchen.</p>
          </Step>

          <Step n={2} title="Neuen Kurzbefehl anlegen">
            <p>Oben rechts auf „+" tippen. Ein leerer Kurzbefehl öffnet sich.</p>
          </Step>

          <Step n={3} title="Erste Aktion: Eingabe aus Teilen-Menü">
            <p>„Aktion hinzufügen" → Suchfeld: „Teilen" → „Eingabe aus Teilen-Menü empfangen" auswählen → Typ auf „URLs" setzen.</p>
          </Step>

          <Step n={4} title="Zweite Aktion: Web-Anfrage senden">
            <p>„Aktion hinzufügen" → Suchfeld: „Web-Anfrage" → auswählen und wie folgt einstellen:</p>
            <SettingsTable rows={[
              ['Methode',        'POST'],
              ['URL',            API_URL],
              ['Header-Name',    'x-api-key'],
              ['Header-Wert',    API_KEY],
              ['Anfrage-Inhalt', 'JSON'],
              ['JSON-Schlüssel', 'url'],
              ['JSON-Wert',      'Eingabe (Variable aus Schritt 1 – nicht manuell eintippen!)'],
            ]} />
          </Step>

          <Step n={5} title={<>Dritte Aktion: Bestätigung anzeigen <span className="font-normal text-gray-400">(empfohlen)</span></>}>
            <p>„Aktion hinzufügen" → „Mitteilung anzeigen" → Text: „Rezept gespeichert ✓"</p>
          </Step>

          <Step n={6} title="Benennen und im Teilen-Menü aktivieren">
            <p>Oben den Namen in „Rezept speichern" ändern. Dann Teilen-Symbol (Quadrat mit Pfeil) oben rechts → „Im Teilen-Menü verwenden" einschalten → „Fertig".</p>
          </Step>
        </div>
      )}

      {/* ── Android ── */}
      {tab === 'android' && (
        <div>
          <h2 className="text-base font-bold text-green-700 mb-1">HTTP Shortcuts einrichten <span className="font-normal text-gray-400 text-sm">(einmalig)</span></h2>
          <p className="text-sm text-gray-500 mb-4">
            Auf Android gibt es keine eingebaute Kurzbefehle-App. Die kostenlose App „HTTP Shortcuts"
            erfüllt denselben Zweck und hängt sich ins Android-Teilen-Menü ein.
          </p>

          <Step n={1} title="App installieren" green>
            <p>Google Play Store öffnen → nach „HTTP Shortcuts" suchen (Entwickler: Waboodoo) → installieren. Die App ist kostenlos und enthält keine Werbung.</p>
          </Step>

          <Step n={2} title="Neuen Shortcut anlegen" green>
            <p>App öffnen → unten rechts auf „+" tippen → „Normaler Shortcut" wählen.</p>
          </Step>

          <Step n={3} title="Grundeinstellungen" green>
            <p>Name: „Rezept speichern"<br />Methode: POST<br />URL: {API_URL}</p>
          </Step>

          <Step n={4} title="Header hinzufügen" green>
            <p>Auf „Header" (oder „Kopfzeilen") tippen → „+" → zwei Header eintragen:</p>
            <SettingsTable rows={[
              ['Content-Type', 'application/json'],
              ['x-api-key',    API_KEY],
            ]} />
          </Step>

          <Step n={5} title="Request-Body konfigurieren" green>
            <p>Auf „Request-Body" (oder „Anfrage-Text") tippen → Typ: „Custom Text" → folgenden Text eingeben:</p>
            <code className="block bg-gray-100 rounded px-3 py-2 font-mono text-gray-700 text-xs mt-1">
              {'{"url": "{share_text}"}'}
            </code>
            <InfoBox green>
              <strong>Hinweis:</strong> <code className="font-mono text-xs">{'{share_text}'}</code> ist eine eingebaute Variable der App.
              Sie wird beim Teilen automatisch durch die URL der geöffneten Seite ersetzt – nicht manuell ändern.
            </InfoBox>
          </Step>

          <Step n={6} title="Im Teilen-Menü aktivieren" green>
            <p>Auf „Ausführungseinstellungen" (oder „Trigger") tippen → „Im Teilen-Menü anzeigen" einschalten → Shortcut speichern.</p>
          </Step>

          <InfoBox>
            <strong>Tipp:</strong> Falls nach dem Speichern im Teilen-Menü nicht „HTTP Shortcuts", sondern direkt
            „Rezept speichern" erscheint: Das ist die gewünschte Einstellung. Sonst tippe zuerst auf
            „HTTP Shortcuts" und dann auf den Shortcut-Namen.
          </InfoBox>
        </div>
      )}

      {/* ── Verwendung ── */}
      {tab === 'verwendung' && (
        <div>
          <h2 className="text-base font-bold text-brand-600 mb-1">Rezept speichern – so geht's</h2>
          <p className="text-sm text-gray-500 mb-4">Nach der Einrichtung reichen drei Schritte, um ein Rezept zu speichern:</p>

          <Step n={1} title="Rezept im Browser öffnen">
            <p>Öffne das Rezept in Safari, Chrome, Firefox oder einem anderen Browser.</p>
          </Step>

          <Step n={2} title="Teilen-Menü aufrufen">
            <p><strong>iOS/iPadOS:</strong> Quadrat-mit-Pfeil-Symbol (unten in der Symbolleiste)</p>
            <p><strong>Android:</strong> Teilen-Symbol im Browser (oft drei verbundene Punkte oder Pfeil-nach-oben)</p>
            <p>Das Teilen-Menü öffnet sich von unten oder als Liste.</p>
          </Step>

          <Step n={3} title={'„Rezept speichern" antippen'}>
            <p>Wische durch die App-Liste im Teilen-Menü und tippe auf „Rezept speichern". Nach wenigen Sekunden erscheint „Rezept gespeichert ✓".</p>
          </Step>

          <InfoBox>
            <strong>Tipp:</strong> Das Rezept ist jetzt unter{' '}
            <a href="https://rezepte.familie-ebert.net" className="underline">rezepte.familie-ebert.net</a>{' '}
            gespeichert. Zutaten, Schritte und Bild werden automatisch übernommen.
          </InfoBox>
        </div>
      )}

      {/* ── FAQ ── */}
      {tab === 'faq' && (
        <div className="space-y-5">
          <h2 className="text-base font-bold text-brand-600 mb-1">Häufige Fragen</h2>

          {[
            {
              q: '„Rezept speichern" erscheint nicht im Teilen-Menü (iPhone/iPad)',
              a: 'Einstellungen → Kurzbefehle → Kurzbefehl antippen → „Im Teilen-Menü verwenden" aktivieren.',
            },
            {
              q: '„Rezept speichern" erscheint nicht im Teilen-Menü (Android)',
              a: 'HTTP-Shortcuts-App öffnen → Shortcut antippen → „Ausführungseinstellungen" → „Im Teilen-Menü anzeigen" einschalten.',
            },
            {
              q: 'Fehlermeldung oder keine Rückmeldung',
              a: 'Prüfe, ob das Gerät mit dem Internet verbunden ist. Falls das Rezept bereits gespeichert ist, erscheint ein Duplikat-Hinweis – öffne rezepte.familie-ebert.net und suche danach.',
            },
            {
              q: 'Ein Rezept wurde nicht vollständig erkannt',
              a: 'Manche Seiten schützen ihre Inhalte vor automatischem Auslesen. Nutze dann den „Importieren"-Button in der Rezeptsammlung und gib die URL manuell ein.',
            },
          ].map(({ q, a }) => (
            <div key={q}>
              <p className="text-sm font-semibold text-gray-900">
                <span className="text-brand-500">F: </span>{q}
              </p>
              <p className="text-sm text-gray-500 mt-0.5 pl-5">
                <span className="font-semibold">A: </span>{a}
              </p>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
