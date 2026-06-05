/**
 * Einladungs-Landingpage – erreichbar unter /einladung/:token.
 * Funktioniert für eingeloggte und nicht eingeloggte Nutzer.
 *
 * Nicht eingeloggt:
 *   → "Mit Google anmelden" → OAuth mit invite-Token → auto-accept → /profil
 *
 * Eingeloggt:
 *   → "Einladung annehmen" → POST /invitations/:token/accept → /profil
 */
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link2, AlertCircle, Clock } from 'lucide-react';
import { invitationApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate  = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['invitation', token],
    queryFn:  () => invitationApi.get(token!),
    enabled:  !!token,
    retry:    false,
    staleTime: Infinity,
  });

  const acceptMutation = useMutation({
    mutationFn: () => invitationApi.accept(token!),
    onSuccess:  () => navigate('/profil'),
  });

  // ── Lade-Zustand ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Einladung ungültig / abgelaufen ────────────────────────────────────────
  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm max-w-sm w-full p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Einladung nicht gefunden</h1>
          <p className="text-sm text-gray-500">
            Dieser Einladungslink ist abgelaufen oder ungültig.
            Bitte den Einladenden bitten, eine neue Einladung zu senden.
          </p>
        </div>
      </div>
    );
  }

  // ── Einladungs-Details ─────────────────────────────────────────────────────
  const initials = data.inviterName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const expiresDate = new Date(data.expiresAt + 'Z');
  const hoursLeft   = Math.max(0, Math.round((expiresDate.getTime() - Date.now()) / 3_600_000));

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm max-w-sm w-full p-8">

        {/* App-Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center text-white text-lg font-bold shrink-0">
            R
          </div>
          <span className="text-base font-semibold text-gray-900">Rezeptsammlung</span>
        </div>

        {/* Einladender */}
        <div className="text-center mb-8">
          {data.inviterPicture ? (
            <img
              src={data.inviterPicture}
              alt={data.inviterName}
              className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-brand-100"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-brand-100 flex items-center justify-center text-2xl font-bold text-brand-700 mx-auto mb-4">
              {initials}
            </div>
          )}
          <h1 className="text-lg font-semibold text-gray-900 mb-1">
            {data.inviterName} lädt dich ein
          </h1>
          <p className="text-sm text-gray-500">
            Verknüpfe dein Konto mit{' '}
            <span className="font-medium text-gray-700">{data.inviterName}</span>, um
            gegenseitig alle Rezepte zu sehen.
          </p>
        </div>

        {/* Was bringt die Verknüpfung? */}
        <div className="bg-brand-50 rounded-xl p-4 mb-6 text-sm text-brand-800 space-y-1.5">
          <div className="flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5 shrink-0" />
            <span>Ihr seht gegenseitig alle Rezepte der anderen Person</span>
          </div>
          <div className="flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5 shrink-0 opacity-0" aria-hidden />
            <span>Rezepte aus verknüpften Konten sind nur lesbar</span>
          </div>
          <div className="flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5 shrink-0 opacity-0" aria-hidden />
            <span>Die Verknüpfung kann jederzeit aufgehoben werden</span>
          </div>
        </div>

        {/* Aktion */}
        {user ? (
          /* ── Eingeloggt: direkt annehmen ────────────────────────── */
          <div className="space-y-3">
            {acceptMutation.isError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-center">
                {(acceptMutation.error as { response?: { data?: { error?: string } } })
                  ?.response?.data?.error ?? 'Fehler beim Annehmen der Einladung'}
              </p>
            )}
            <button
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending || acceptMutation.isSuccess}
              className="btn-primary w-full"
            >
              {acceptMutation.isPending
                ? 'Wird verbunden…'
                : acceptMutation.isSuccess
                ? '✓ Verbunden'
                : 'Einladung annehmen'}
            </button>
            <p className="text-xs text-center text-gray-400">
              Angemeldet als {user.email}
            </p>
          </div>
        ) : (
          /* ── Nicht eingeloggt: Google-Login mit Invite-Token ─────── */
          <div className="space-y-3">
            <a
              href={`/api/auth/google?invite=${encodeURIComponent(token!)}&redirect=/profil`}
              className="btn-primary w-full flex items-center justify-center gap-2 no-underline"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
                <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Mit Google anmelden
            </a>
            <p className="text-xs text-center text-gray-400">
              Die Einladung wird nach der Anmeldung automatisch angenommen.
            </p>
          </div>
        )}

        {/* Ablauf-Hinweis */}
        {hoursLeft > 0 && (
          <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            Einladung gültig noch ca. {hoursLeft} Stunde{hoursLeft !== 1 ? 'n' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
