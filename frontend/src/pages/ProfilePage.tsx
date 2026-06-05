/**
 * Profilseite – Nutzerinfos, Abmelden und Kontoverbindungen an einem Ort.
 * Erreichbar per Klick auf das Profilfoto in der Navigationsleiste.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut, Link2, UserPlus, Check, X, Trash2, Clock, Users, Mail, Settings, Download, Share, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { accountApi } from '../api/client';
import { AccountLink, Invitation } from '../types/recipe';
import { loadSettings, saveSettings, AppSettings } from '../utils/settings';
import { useInstallPrompt, isAndroid } from '../hooks/useInstallPrompt';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const { status: installStatus, install } = useInstallPrompt();
  const [email, setEmail] = useState('');
  const [requestError, setRequestError]     = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');
  const [appSettings, setAppSettings] = useState<AppSettings>(loadSettings);

  const updateAppSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const next = { ...appSettings, [key]: value };
    setAppSettings(next);
    saveSettings(next);
  };

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['account-links'],
    queryFn:  accountApi.getLinks,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['account-invitations'],
    queryFn:  accountApi.getInvitations,
  });

  const requestMutation = useMutation({
    mutationFn: () => accountApi.requestLink(email.trim()),
    onSuccess: (result) => {
      setEmail('');
      setRequestError('');
      if (result.type === 'link') {
        setRequestSuccess(`Anfrage an ${result.linkedUser.name} gesendet.`);
        qc.invalidateQueries({ queryKey: ['account-links'] });
      } else {
        setRequestSuccess(`Einladungs-E-Mail an ${result.email} gesendet.`);
        qc.invalidateQueries({ queryKey: ['account-invitations'] });
      }
      setTimeout(() => setRequestSuccess(''), 5000);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setRequestError(msg ?? 'Anfrage fehlgeschlagen');
      setRequestSuccess('');
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (id: number) => accountApi.acceptLink(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['account-links'] });
      qc.invalidateQueries({ queryKey: ['recipes'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => accountApi.removeLink(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['account-links'] });
      qc.invalidateQueries({ queryKey: ['recipes'] });
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: (id: number) => accountApi.cancelInvitation(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['account-invitations'] }),
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

      {/* ── App installieren ────────────────────────────────────────────── */}
      <InstallBanner status={installStatus} onInstall={install} />

      {/* ── Verknüpfte Konten ────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <Link2 className="w-4 h-4 text-brand-500" />
          Verknüpfte Konten
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Verknüpfe dein Konto mit einer anderen Person – dann sehen beide gegenseitig
          alle Rezepte der jeweils anderen. Ist die E-Mail-Adresse noch nicht registriert,
          wird automatisch eine Einladungs-E-Mail verschickt.
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
          invitations.length === 0 && (
            <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-gray-100">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Noch keine Verknüpfungen.</p>
            </div>
          )
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

        {/* Gesendete Einladungen (E-Mails ohne registriertes Konto) */}
        {invitations.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-brand-500" />
              Gesendete Einladungen ({invitations.length})
            </h3>
            <ul className="space-y-3">
              {invitations.map((inv) => (
                <InvitationRow
                  key={inv.id}
                  invitation={inv}
                  onCancel={() => cancelInvitationMutation.mutate(inv.id)}
                  cancelling={cancelInvitationMutation.isPending}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
      {/* ── App-Einstellungen ───────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <Settings className="w-4 h-4 text-brand-500" />
          Einstellungen
        </h2>
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          <SettingToggle
            label="Display beim Kochen nicht ausschalten"
            description="Der Bildschirm bleibt im Kochmodus aktiv und schaltet sich nicht automatisch ab."
            checked={appSettings.keepScreenAwake}
            onChange={(v) => updateAppSetting('keepScreenAwake', v)}
          />
        </div>
      </div>

    </div>
  );
}

// ── Hilfs-Komponenten ────────────────────────────────────────────────────────

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

// ── Install-Banner ───────────────────────────────────────────────────────────

function InstallBanner({
  status,
  onInstall,
}: {
  status: 'installable' | 'ios' | 'manual' | 'installed' | 'unavailable';
  onInstall: () => Promise<boolean>;
}) {
  const [installing, setInstalling] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [showManualHint, setShowManualHint] = useState(false);

  if (status === 'unavailable') return null;

  const handleInstall = async () => {
    setInstalling(true);
    await onInstall();
    setInstalling(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
      {status === 'installed' ? (
        /* ── Bereits installiert ── */
        <div className="flex items-center gap-3 text-green-700">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div>
            <p className="text-sm font-medium">App ist installiert</p>
            <p className="text-xs text-gray-400 mt-0.5">Die Rezeptsammlung läuft als eigenständige App.</p>
          </div>
        </div>
      ) : status === 'installable' ? (
        /* ── Chrome/Edge: direkter Install-Button ── */
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center text-white text-lg font-bold shrink-0">
              R
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800">App installieren</p>
              <p className="text-xs text-gray-400 mt-0.5">Schnellzugriff vom Home-Bildschirm, kein Browser nötig.</p>
            </div>
          </div>
          <button
            onClick={handleInstall}
            disabled={installing}
            className="btn-primary shrink-0 flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            {installing ? 'Installiert…' : 'Installieren'}
          </button>
        </div>
      ) : status === 'ios' ? (
        /* ── iOS Safari: manuelle Anleitung ── */
        <div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center text-white text-lg font-bold shrink-0">
                R
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">App installieren</p>
                <p className="text-xs text-gray-400 mt-0.5">Zum Home-Bildschirm hinzufügen</p>
              </div>
            </div>
            <button
              onClick={() => setShowIosHint((h) => !h)}
              className="btn-secondary shrink-0 flex items-center gap-1.5 text-sm"
            >
              <Share className="w-4 h-4" />
              Anleitung
            </button>
          </div>
          {showIosHint && (
            <div className="mt-3 bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-2">
              <p className="font-medium text-gray-800">So installierst du die App auf iOS:</p>
              <ol className="space-y-1.5 ml-1 list-decimal list-inside">
                <li>Tippe auf das <strong>Teilen-Symbol</strong> <span className="inline-flex items-center gap-0.5">(<Share className="w-3.5 h-3.5 inline" />)</span> unten in Safari</li>
                <li>Scrolle nach unten und tippe auf <strong>„Zum Home-Bildschirm"</strong></li>
                <li>Tippe auf <strong>„Hinzufügen"</strong> oben rechts</li>
              </ol>
              <p className="text-xs text-gray-400 mt-2">
                Die App erscheint dann wie eine normale App auf deinem Home-Bildschirm –
                ohne Adressleiste und mit schnellerem Start.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* ── Chromium (Android/Desktop): Browser-Menü-Anleitung ──
             Wird angezeigt wenn der automatische Prompt nicht verfügbar ist
             (z.B. nach Deinstallation – Chrome hat eine Abklingzeit von einigen Tagen). */
        <div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center text-white text-lg font-bold shrink-0">
                R
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">App installieren</p>
                <p className="text-xs text-gray-400 mt-0.5">Über das Browser-Menü</p>
              </div>
            </div>
            <button
              onClick={() => setShowManualHint((h) => !h)}
              className="btn-secondary shrink-0 flex items-center gap-1.5 text-sm"
            >
              <Download className="w-4 h-4" />
              Anleitung
            </button>
          </div>
          {showManualHint && (
            <div className="mt-3 bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-2">
              {isAndroid() ? (
                <>
                  <p className="font-medium text-gray-800">So installierst du die App auf Android:</p>
                  <ol className="space-y-1.5 ml-1 list-decimal list-inside">
                    <li>Tippe auf das <strong>Menü-Symbol ⋮</strong> oben rechts im Browser</li>
                    <li>Tippe auf <strong>„App installieren"</strong> oder <strong>„Zum Startbildschirm"</strong></li>
                    <li>Bestätige mit <strong>„Installieren"</strong></li>
                  </ol>
                </>
              ) : (
                <>
                  <p className="font-medium text-gray-800">So installierst du die App im Browser:</p>
                  <ol className="space-y-1.5 ml-1 list-decimal list-inside">
                    <li>Klicke auf das <strong>Installieren-Symbol</strong> (↧) ganz rechts in der Adressleiste</li>
                    <li>Bestätige mit <strong>„Installieren"</strong></li>
                  </ol>
                  <p className="text-xs text-gray-400">
                    Falls das Symbol nicht sichtbar ist: Menü ⋮ → „Rezeptsammlung installieren"
                  </p>
                </>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Tipp: Falls die Option fehlt, kurz warten – Chrome zeigt sie nach einer
                Deinstallation erst nach einigen Tagen wieder automatisch an.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = label.replace(/\s+/g, '-').toLowerCase();
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-gray-800 cursor-pointer select-none">
          {label}
        </label>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      {/* Toggle-Switch */}
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
          checked ? 'bg-brand-500' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function InvitationRow({
  invitation,
  onCancel,
  cancelling,
}: {
  invitation: Invitation;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const expiresDate = new Date(invitation.expiresAt + 'Z');
  const hoursLeft   = Math.max(0, Math.round((expiresDate.getTime() - Date.now()) / 3_600_000));

  return (
    <li className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
          <Mail className="w-4 h-4 text-gray-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">{invitation.email}</p>
          <p className="text-xs text-gray-400">
            {hoursLeft > 0 ? `Läuft in ca. ${hoursLeft} Std. ab` : 'Läuft bald ab'}
          </p>
        </div>
      </div>
      <button
        onClick={onCancel}
        disabled={cancelling}
        className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
        title="Einladung zurückziehen"
      >
        <X className="w-4 h-4" />
      </button>
    </li>
  );
}
