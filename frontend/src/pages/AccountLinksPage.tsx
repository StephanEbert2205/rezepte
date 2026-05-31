/**
 * Konto-Verknüpfungen verwalten.
 * Verknüpfte Konten sehen gegenseitig alle Rezepte (Lesezugriff).
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2, UserPlus, Check, X, Trash2, Clock, Users } from 'lucide-react';
import { accountApi } from '../api/client';
import { AccountLink } from '../types/recipe';

export default function AccountLinksPage() {
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
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Link2 className="w-6 h-6 text-brand-500" />
          Verknüpfte Konten
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Verknüpfe dein Konto mit anderen Nutzern, um gemeinsam auf alle Rezepte zugreifen zu können.
        </p>
      </div>

      {/* Anfrage senden */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-brand-500" />
          Konto verknüpfen
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Gib die E-Mail-Adresse des anderen Nutzers ein. Er erhält eine Verknüpfungsanfrage
          und muss diese bestätigen.
        </p>
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
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 mb-6">
          <h2 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Offene Anfragen ({incoming.length})
          </h2>
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

      {/* Aktive Verknüpfungen */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Lädt…</div>
      ) : accepted.length === 0 && outgoing.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Noch keine Verknüpfungen.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Verknüpfungen</h2>
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
          <p className="text-sm font-medium text-gray-800 truncate">{link.linkedUser.name}</p>
          <p className="text-xs text-gray-400 truncate">{link.linkedUser.email}</p>
        </div>
        {badge}
      </div>
      <div className="flex items-center gap-2 shrink-0">{actions}</div>
    </li>
  );
}
