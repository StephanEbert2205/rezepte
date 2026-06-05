/**
 * Changelog-Seite – zeigt alle veröffentlichten App-Updates.
 * Beim Aufruf wird der Lesezeitpunkt des Nutzers in der DB gespeichert,
 * damit das blaue Ungelesen-Pünktchen im Nav verschwindet.
 */
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Megaphone } from 'lucide-react';
import { changelogApi, ChangelogEntry } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export default function ChangelogPage() {
  const { refreshUser } = useAuth();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['changelog'],
    queryFn:  changelogApi.list,
  });

  // Beim Öffnen der Seite: Lesezeitstempel setzen → Badge verschwindet
  useEffect(() => {
    changelogApi.markRead().then(() => refreshUser()).catch(() => {/* ignorieren */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
          <Megaphone className="w-5 h-5 text-brand-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Was ist neu?</h1>
          <p className="text-sm text-gray-400">Aktuelle Änderungen und Verbesserungen</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">Noch keine Einträge vorhanden.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertikale Timeline-Linie */}
          <div className="absolute left-[11px] top-3 bottom-3 w-px bg-gray-100" />

          <div className="space-y-8">
            {entries.map((entry: ChangelogEntry) => (
              <ChangelogCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChangelogCard({ entry }: { entry: ChangelogEntry }) {
  const date = formatDate(entry.releaseDate);

  return (
    <div className="pl-8 relative">
      {/* Timeline-Punkt */}
      <div className="absolute left-0 top-3 w-[23px] h-[23px] rounded-full border-2 border-brand-300 bg-white flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-brand-400" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {/* Meta-Zeile */}
        <div className="flex items-center gap-2.5 flex-wrap mb-3">
          {entry.version && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700 border border-brand-100">
              v{entry.version}
            </span>
          )}
          <time className="text-xs text-gray-400 font-medium">{date}</time>
        </div>

        {/* Titel */}
        <h2 className="text-base font-semibold text-gray-900 mb-3">{entry.title}</h2>

        {/* Body – eine Zeile = ein Listenpunkt */}
        {entry.body && (
          <ChangelogBody body={entry.body} />
        )}
      </div>
    </div>
  );
}

function ChangelogBody({ body }: { body: string }) {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);

  // Wenn alle Zeilen mit "•", "-" oder "*" anfangen → Bullet-Liste
  // Andernfalls Absätze
  const isBulletList = lines.every((l) => /^[•\-*]/.test(l));

  if (isBulletList) {
    return (
      <ul className="space-y-1.5">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-300 shrink-0" />
            <span>{line.replace(/^[•\-*]\s*/, '')}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-2">
      {lines.map((line, i) => (
        <p key={i} className="text-sm text-gray-600 leading-relaxed">{line}</p>
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('de-DE', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return iso;
  }
}
