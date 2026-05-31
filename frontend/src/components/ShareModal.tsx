import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Link2, Mail, Trash2, Copy, Check, Edit, Eye } from 'lucide-react';
import { recipeApi } from '../api/client';

interface Props {
  recipeId: number;
  recipeTitle: string;
  onClose: () => void;
}

export default function ShareModal({ recipeId, recipeTitle, onClose }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'link' | 'direct'>('link');
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [shareError, setShareError] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);

  const shareUrl = token
    ? `${window.location.origin}/teilen/${token}`
    : null;

  // Direkte Freigaben laden
  const { data: shares = [], refetch: refetchShares } = useQuery({
    queryKey: ['shares', recipeId],
    queryFn:  () => recipeApi.getShares(recipeId),
  });

  // Token erzeugen
  const tokenMutation = useMutation({
    mutationFn: () => recipeApi.createShareToken(recipeId),
    onSuccess:  (d) => setToken(d.token),
  });

  // Link in Zwischenablage kopieren
  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Mit User teilen
  const addShareMutation = useMutation({
    mutationFn: () => recipeApi.addShare(recipeId, email.trim(), canEdit),
    onSuccess: () => {
      setEmail('');
      setCanEdit(false);
      setShareError('');
      refetchShares();
      qc.invalidateQueries({ queryKey: ['shares', recipeId] });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setShareError(msg ?? 'Freigabe fehlgeschlagen');
    },
  });

  // Freigabe entfernen
  const removeShareMutation = useMutation({
    mutationFn: (sharedWithId: number) => recipeApi.removeShare(recipeId, sharedWithId),
    onSuccess:  () => {
      refetchShares();
      qc.invalidateQueries({ queryKey: ['shares', recipeId] });
    },
  });

  // ESC schließt Modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Tab-Wechsel: E-Mail-Feld fokussieren
  useEffect(() => {
    if (tab === 'direct') setTimeout(() => emailRef.current?.focus(), 50);
  }, [tab]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Rezept teilen</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="px-6 pt-3 pb-0 text-sm text-gray-500 truncate">{recipeTitle}</p>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3">
          <button
            onClick={() => setTab('link')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'link' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Link2 className="w-4 h-4" />
            Kopier-Link
          </button>
          <button
            onClick={() => setTab('direct')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'direct' ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Mail className="w-4 h-4" />
            Direkt freigeben
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* ── Tab: Kopier-Link ── */}
          {tab === 'link' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Erstelle einen Link, den du weiterschicken kannst. Wer den Link öffnet, erhält
                eine <strong>eigene Kopie</strong> des Rezepts – Änderungen sind unabhängig.
              </p>

              {!token ? (
                <button
                  onClick={() => tokenMutation.mutate()}
                  disabled={tokenMutation.isPending}
                  className="btn-primary w-full justify-center"
                >
                  <Link2 className="w-4 h-4" />
                  {tokenMutation.isPending ? 'Generiere…' : 'Freigabelink erstellen'}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={shareUrl ?? ''}
                      className="input flex-1 text-xs bg-gray-50 select-all"
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      onClick={handleCopy}
                      className="btn-secondary px-3 shrink-0"
                      title="Kopieren"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">
                    Link einmalig gültig (überschreibt vorherigen Link).
                  </p>
                  <button
                    onClick={() => { setToken(null); tokenMutation.reset(); }}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    Neuen Link erstellen
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Direkte Freigabe ── */}
          {tab === 'direct' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Teile das Rezept direkt mit einem anderen Nutzer. Das Rezept bleibt eines –
                Änderungen sind für beide sichtbar (je nach Berechtigung).
              </p>

              <div className="space-y-2">
                <input
                  ref={emailRef}
                  type="email"
                  placeholder="E-Mail-Adresse des Nutzers"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setShareError(''); }}
                  className="input w-full"
                  onKeyDown={(e) => { if (e.key === 'Enter' && email.trim()) addShareMutation.mutate(); }}
                />

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="perm"
                      checked={!canEdit}
                      onChange={() => setCanEdit(false)}
                      className="accent-brand-600"
                    />
                    <Eye className="w-3.5 h-3.5" /> Nur ansehen
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="perm"
                      checked={canEdit}
                      onChange={() => setCanEdit(true)}
                      className="accent-brand-600"
                    />
                    <Edit className="w-3.5 h-3.5" /> Ansehen &amp; bearbeiten
                  </label>
                </div>

                {shareError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{shareError}</p>
                )}

                <button
                  onClick={() => addShareMutation.mutate()}
                  disabled={!email.trim() || addShareMutation.isPending}
                  className="btn-primary w-full justify-center"
                >
                  {addShareMutation.isPending ? 'Teile…' : 'Freigabe hinzufügen'}
                </button>
              </div>

              {/* Bestehende Freigaben */}
              {shares.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Aktive Freigaben
                  </p>
                  <ul className="space-y-2">
                    {shares.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 gap-3"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {s.sharedWith.picture ? (
                            <img src={s.sharedWith.picture} alt="" className="w-6 h-6 rounded-full shrink-0" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-[10px] font-bold text-brand-700 shrink-0">
                              {s.sharedWith.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{s.sharedWith.name}</p>
                            <p className="text-xs text-gray-400 truncate">{s.sharedWith.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
                            s.canEdit ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {s.canEdit ? <><Edit className="w-3 h-3" /> Bearbeiten</> : <><Eye className="w-3 h-3" /> Ansehen</>}
                          </span>
                          <button
                            onClick={() => removeShareMutation.mutate(s.sharedWith.id)}
                            disabled={removeShareMutation.isPending}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
