/**
 * Profilseite – Nutzerinfos, Abmelden und Kontoverbindungen an einem Ort.
 * Erreichbar per Klick auf das Profilfoto in der Navigationsleiste.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut, Link2, UserPlus, Check, X, Trash2, Clock, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { accountApi } from '../api/client';
import { AccountLink } from '../types/recipe';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['account-links'],
    queryFn:  accountApi.getLinks,
  });

  const requestMutation = useMutation({
    mutationFn: () => accountApi.requestLink(email.trim()),
    onSuccess: (link) => {
      setEmail('');
      setRequestError('');
      setRequestSuccess(`Anfrage an ${link.linkedUser.name} gesendet.`);
      setTimeout(() => setRequestSuccess(''), 4000);
      qc.invalidateQueries({ queryKey: ['account-links'] });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setRequestError(msg ?? 'Anfrage fehlgeschlagen');
      setRequestSuccess('');
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (id: number) => accountApi.acceptLink(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['account-links'] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => accountApi.removeLink(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['account-links'] });
      qc.invalidateQueries({ queryKey: ['recipes'] });
    },
  });

  const incoming = links.filter((l) => l.direction === 'incoming' && l.status === 'pending');
  const accepted = links.filter((l) => l.status === 'accepted');
  const outgoing = links.filter((l) => l.direction === 'outgoing' && l.status === 'pending');

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">

      {/* ── Nutzerkarte ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-4">
          {user?.picture ? (
            <img src={user.picture} alt={user.name} className="w-16 h-16 rounded-full" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center text-2xl font-bold text-brand-700">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-lg font-semibold text-gray-900 truncate">{user?.name}</p>
            <p className="text-sm text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Abmelden
        </button>
      </div>

      {/* ── Verknüpfte Konten ────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <Link2 className="w-4 h-4 text-brand-500" />
          Verknüpfte Konten
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Verknüpfe dein Konto mit einer anderen Person – dann sehen beide gegenseitig
          alle Rezepte der jeweils anderen.
        </p>

        {/* Anfrage senden */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-brand-500" />
            Konto verknüpfen
          </h3>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="E-Mail-Adresse"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setRequestError(''); }}
              className="input flex-1"
              onKeyDown={(e) => { if (e.key === 'Enter' && email.trim()) requestMutation.mutate(); }}
            />
            <button
              onClick={() => requestMutation.mutate()}
              disabled={!email.trim() || requestMutation.isPending}
              className="btn-primary shrink-0"
            >
              {requestMutation.isPending ? 'Sendet…' : 'Anfragen'}
            </button>
          </div>
          {requestError && (
            <p className="text-sm text-red-600 mt-2 bg-red-50 rounded-lg px-3 py-2">{requestError}</p>
          )}
          {requestSuccess && (
            <p className="text-sm text-green-700 mt-2 bg-green-50 rounded-lg px-3 py-2">✓ {requestSuccess}</p>
          )}
        </div>

        {/* Eingehende Anfragen */}
        {incoming.length > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 mb-4">
            <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Offene Anfragen ({incoming.length})
            </h3>
            <ul className="space-y-3">
              {incoming.map((link) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  actions={
                    <>
                      <button
                        onClick={() => acceptMutation.mutate(link.id)}
                        disabled={acceptMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" /> Annehmen
                      </button>
                      <button
                        onClick={() => removeMutation.mutate(link.id)}
                        disabled={removeMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" /> Ablehnen
                      </button>
                    </>
                  }
                />
              ))}
            </ul>
          </div>
        )}

        {/* Aktive & ausstehende Verknüpfungen */}
        {isLoading ? (
          <div className="text-center py-6 text-gray-400 text-sm">Lädt…</div>
        ) : accepted.length === 0 && outgoing.length === 0 ? (
          <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-gray-100">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Noch keine Verknüpfungen.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <ul className="space-y-3">
              {accepted.map((link) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  badge={<span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Verknüpft</span>}
                  actions={
                    <button
                      onClick={() => removeMutation.mutate(link.id)}
                      disabled={removeMutation.isPending}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      title="Verknüpfung entfernen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  }
                />
              ))}
              {outgoing.map((link) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  badge={<span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Ausstehend</span>}
                  actions={
                    <button
                      onClick={() => removeMutation.mutate(link.id)}
                      disabled={removeMutation.isPending}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      title="Anfrage zurückziehen"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  }
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function LinkRow({
  link,
  badge,
  actions,
}: {
  link: AccountLink;
  badge?: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {link.linkedUser.picture ? (
          <img src={link.linkedUser.picture} alt="" className="w-9 h-9 rounded-full shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-sm font-bold text-brand-700 shrink-0">
            {link.linkedUser.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-800 truncate">{link.linkedUser.name}</p>
            {badge}
          </div>
          <p className="text-xs text-gray-400 truncate">{link.linkedUser.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">{actions}</div>
    </li>
  );
}
