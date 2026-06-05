/**
 * Admin-Dashboard – nur für Nutzer mit isAdmin = true erreichbar.
 * Tabs: Übersicht · Nutzer · Rezepte · Verbindungen
 */
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users, BookOpen, Link2, BarChart2, Shield, ShieldOff,
  Search, ChevronLeft, ChevronRight, ExternalLink, Flag, CheckCheck,
  Megaphone, Plus, Pencil, Trash2, Globe, EyeOff, GitCommit, Loader2, X,
  CheckCircle, Download, Check, SkipForward, Zap, ListChecks, FileText,
  RefreshCw,
} from 'lucide-react';
import { adminApi, AdminUser, AdminReport, changelogApi, ChangelogEntry, ChangelogCommit, ImportResult } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'stats' | 'users' | 'recipes' | 'links' | 'reports' | 'changelog';

export default function AdminPage() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [tab, setTab] = useState<Tab>('stats');

  // Zugriffsschutz (doppelt – Backend blockt sowieso)
  if (!user?.isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <Shield className="w-12 h-12 mx-auto text-red-300 mb-4" />
        <p className="text-gray-500">Kein Zugriff.</p>
      </div>
    );
  }

  const tabs: { id: Tab; icon: React.ElementType; label: string }[] = [
    { id: 'stats',     icon: BarChart2,  label: 'Übersicht'    },
    { id: 'users',     icon: Users,      label: 'Nutzer'        },
    { id: 'recipes',   icon: BookOpen,   label: 'Alle Rezepte'  },
    { id: 'links',     icon: Link2,      label: 'Verbindungen'  },
    { id: 'reports',   icon: Flag,       label: 'Meldungen'     },
    { id: 'changelog', icon: Megaphone,  label: 'Changelog'     },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
          <Shield className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Admin</h1>
          <p className="text-xs text-gray-400">Angemeldet als {user.email}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === 'stats'     && <StatsTab />}
      {tab === 'users'     && <UsersTab currentAdminId={user.id} />}
      {tab === 'recipes'   && <RecipesTab onNavigate={(id) => navigate(`/rezepte/${id}`)} />}
      {tab === 'links'     && <LinksTab />}
      {tab === 'reports'   && <ReportsTab onNavigate={(id) => navigate(`/rezepte/${id}`)} />}
      {tab === 'changelog' && <ChangelogTab />}
    </div>
  );
}

// ── Übersicht ─────────────────────────────────────────────────────────────────

function StatsTab() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-stats'], queryFn: adminApi.getStats });

  if (isLoading) return <Spinner />;
  if (!data)     return <Empty text="Keine Daten" />;

  const cards = [
    { label: 'Nutzer',           value: data.users,        color: 'bg-blue-50 text-blue-700'   },
    { label: 'Rezepte',          value: data.recipes,       color: 'bg-brand-50 text-brand-700' },
    { label: 'Zutaten gesamt',   value: data.ingredients,   color: 'bg-green-50 text-green-700' },
    { label: 'Aktive Verbindungen', value: data.activeLinks, color: 'bg-purple-50 text-purple-700' },
    { label: 'Offene Anfragen',  value: data.pendingLinks,  color: 'bg-amber-50 text-amber-700' },
    { label: 'Offene Einladungen', value: data.invitations, color: 'bg-red-50 text-red-700'    },
    { label: 'Offene Meldungen', value: data.openReports ?? 0, color: 'bg-orange-50 text-orange-700' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI-Karten */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl p-4 ${color} bg-opacity-60`}>
            <p className="text-2xl font-bold">{value.toLocaleString('de')}</p>
            <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
          </div>
        ))}
      </div>

      {/* Top Quellen */}
      {data.topSources.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Top-Import-Quellen</h2>
          <div className="space-y-2">
            {data.topSources.map(({ domain, count }) => {
              const pct = Math.round((count / data.recipes) * 100);
              return (
                <div key={domain} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-44 truncate shrink-0">{domain}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-brand-400 h-2 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-10 text-right shrink-0">{count}</span>
                </div>
              );
            })}
            <p className="text-xs text-gray-300 mt-1">
              {data.recipes - data.topSources.reduce((s, r) => s + r.count, 0)} Rezepte ohne Quelle (manuell)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Nutzer ────────────────────────────────────────────────────────────────────

function UsersTab({ currentAdminId }: { currentAdminId: number }) {
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn:  adminApi.getUsers,
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => adminApi.toggleAdmin(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="text-left px-4 py-3 font-semibold text-gray-600">Nutzer</th>
            <th className="text-right px-4 py-3 font-semibold text-gray-600">Rezepte</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Letzte Aktivität</th>
            <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Seit</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {users.map((u: AdminUser) => (
            <tr key={u.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  {u.picture ? (
                    <img src={u.picture} className="w-8 h-8 rounded-full shrink-0" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700 shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-800 truncate">{u.name}</span>
                      {u.isAdmin && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700 shrink-0">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-right font-medium text-gray-700">
                {u.recipeCount}
              </td>
              <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">
                {u.lastRecipeAt ? fmtDate(u.lastRecipeAt) : '–'}
              </td>
              <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">
                {fmtDate(u.createdAt)}
              </td>
              <td className="px-4 py-3 text-right">
                {u.id !== currentAdminId && (
                  <button
                    onClick={() => toggleMutation.mutate(u.id)}
                    disabled={toggleMutation.isPending}
                    title={u.isAdmin ? 'Admin-Rechte entziehen' : 'Zum Admin machen'}
                    className={`p-1.5 rounded-lg transition-colors ${
                      u.isAdmin
                        ? 'text-red-400 hover:bg-red-50'
                        : 'text-gray-300 hover:bg-gray-100 hover:text-gray-600'
                    }`}
                  >
                    {u.isAdmin ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Alle Rezepte ──────────────────────────────────────────────────────────────

function RecipesTab({ onNavigate }: { onNavigate: (id: number) => void }) {
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-recipes', debouncedSearch, page],
    queryFn:  () => adminApi.getRecipes({ search: debouncedSearch, page }),
    placeholderData: (prev) => prev,
  });

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
    clearTimeout((window as unknown as { _adminSearchTimer?: ReturnType<typeof setTimeout> })._adminSearchTimer);
    (window as unknown as { _adminSearchTimer?: ReturnType<typeof setTimeout> })._adminSearchTimer =
      setTimeout(() => setDebouncedSearch(v), 350);
  };

  return (
    <div className="space-y-4">
      {/* Suchzeile */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Titel oder Domain suchen…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="input pl-9 w-full"
        />
      </div>

      {isLoading ? <Spinner /> : !data ? null : (
        <>
          <p className="text-xs text-gray-400">{data.total.toLocaleString('de')} Rezepte gefunden</p>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Rezept</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Besitzer</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Quelle</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Zutaten</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Erstellt</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.recipes.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {r.imageUrl ? (
                          <img src={r.imageUrl} className="w-9 h-9 rounded-lg object-cover shrink-0" alt="" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate max-w-[180px]">{r.title}</p>
                          <div className="flex gap-1 mt-0.5">
                            {r.isVegan && <span className="text-xs text-green-600">Vegan</span>}
                            {r.isVegetarian && !r.isVegan && <span className="text-xs text-green-600">Vegetarisch</span>}
                            {r.isGlutenFree && <span className="text-xs text-yellow-600">GF</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-gray-700 truncate max-w-[130px]">{r.owner.name}</p>
                      <p className="text-xs text-gray-400 truncate max-w-[130px]">{r.owner.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">
                      {r.sourceDomain ?? <span className="italic">manuell</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">{r.ingredientCount}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onNavigate(r.id)}
                        title="Rezept ansehen"
                        className="p-1.5 rounded-lg text-gray-300 hover:text-brand-500 hover:bg-brand-50 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary text-sm disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-500">
                Seite {page} / {data.pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page >= data.pages}
                className="btn-secondary text-sm disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Verbindungen & Einladungen ────────────────────────────────────────────────

function LinksTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-links'],
    queryFn:  adminApi.getLinks,
  });

  if (isLoading) return <Spinner />;
  if (!data)     return <Empty text="Keine Daten" />;

  return (
    <div className="space-y-6">
      {/* Kontoverbindungen */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Kontoverbindungen ({data.links.length})
        </h2>
        {data.links.length === 0 ? (
          <Empty text="Keine Verbindungen" />
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Anfragender</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Empfänger</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Erstellt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.links.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{l.requester.name}</p>
                      <p className="text-xs text-gray-400">{l.requester.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{l.accepter.name}</p>
                      <p className="text-xs text-gray-400">{l.accepter.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        l.status === 'accepted'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {l.status === 'accepted' ? 'Aktiv' : 'Ausstehend'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">
                      {fmtDate(l.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Offene Einladungen */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Offene Einladungen ({data.invitations.length})
        </h2>
        {data.invitations.length === 0 ? (
          <Empty text="Keine offenen Einladungen" />
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Eingeladene E-Mail</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Eingeladen von</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Läuft ab</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{inv.email}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{inv.inviterName}</p>
                      <p className="text-xs text-gray-400">{inv.inviterEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">
                      {fmtDate(inv.expiresAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Meldungen ─────────────────────────────────────────────────────────────────

function ReportsTab({ onNavigate }: { onNavigate: (id: number) => void }) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'open' | 'resolved' | 'all'>('open');

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['admin-reports', statusFilter],
    queryFn:  () => adminApi.getReports(statusFilter),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: number) => adminApi.resolveReport(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['admin-reports'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['open', 'resolved', 'all'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              statusFilter === s
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s === 'open' ? 'Offen' : s === 'resolved' ? 'Erledigt' : 'Alle'}
          </button>
        ))}
      </div>

      {isLoading ? <Spinner /> : reports.length === 0 ? (
        <Empty text={statusFilter === 'open' ? 'Keine offenen Meldungen 🎉' : 'Keine Meldungen'} />
      ) : (
        <div className="space-y-3">
          {reports.map((r: AdminReport) => (
            <div
              key={r.id}
              className={`bg-white rounded-xl border p-4 ${
                r.status === 'open' ? 'border-orange-100' : 'border-gray-100 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                {/* Rezept + Kategorien */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <button
                      onClick={() => onNavigate(r.recipe.id)}
                      className="text-sm font-semibold text-gray-900 hover:text-brand-600 transition-colors flex items-center gap-1"
                    >
                      {r.recipe.title}
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </button>
                    {r.recipe.source && (
                      <span className="text-xs text-gray-400">{r.recipe.source}</span>
                    )}
                  </div>
                  {/* Kategorie-Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {r.categoryLabels.map((label) => (
                      <span
                        key={label}
                        className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-100"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  {/* Kommentar */}
                  {r.comment && (
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 italic">
                      „{r.comment}"
                    </p>
                  )}
                  {/* Meta */}
                  <p className="text-xs text-gray-400 mt-2">
                    Gemeldet von <strong className="text-gray-600">{r.reporter.name}</strong>
                    {' '}({r.reporter.email}) · {fmtDate(r.createdAt)}
                    {r.resolvedAt && ` · Erledigt: ${fmtDate(r.resolvedAt)}`}
                  </p>
                </div>

                {/* Aktion */}
                {r.status === 'open' && (
                  <button
                    onClick={() => resolveMutation.mutate(r.id)}
                    disabled={resolveMutation.isPending}
                    title="Als erledigt markieren"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors shrink-0 disabled:opacity-50"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Erledigt
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Changelog ─────────────────────────────────────────────────────────────────

// ── Changelog ─────────────────────────────────────────────────────────────────

type ChangelogSubTab = 'commits' | 'entries';

type ChangelogFormData = {
  version:     string;
  releaseDate: string;
  title:       string;
  body:        string;
  isPublished: boolean;
};

const EMPTY_FORM: ChangelogFormData = {
  version:     '',
  releaseDate: new Date().toISOString().slice(0, 10),
  title:       '',
  body:        '',
  isPublished: false,
};

function ChangelogTab() {
  const [subTab, setSubTab] = useState<ChangelogSubTab>('commits');

  const { data: pendingData } = useQuery({
    queryKey: ['changelog-pending-count'],
    queryFn:  changelogApi.pendingCount,
    refetchInterval: 30_000,
  });
  const pendingCount = pendingData?.count ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setSubTab('commits')}
          className={`relative flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            subTab === 'commits' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <GitCommit className="w-4 h-4" />
          Commits
          {pendingCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500 text-white">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setSubTab('entries')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            subTab === 'entries' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          Einträge
        </button>
      </div>

      {subTab === 'commits' && <CommitsReviewTab onDraftCreated={() => setSubTab('entries')} />}
      {subTab === 'entries' && <EntriesTab />}
    </div>
  );
}

// ── Commits-Review ────────────────────────────────────────────────────────────

type CommitFilter = 'pending' | 'included' | 'skipped';

function CommitsReviewTab({ onDraftCreated }: { onDraftCreated: () => void }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<CommitFilter>('pending');
  const [importMsg, setImportMsg] = useState<ImportResult | null>(null);

  const { data: commits = [], isLoading } = useQuery({
    queryKey: ['admin-cl-commits', filter],
    queryFn:  () => changelogApi.listCommits(filter),
  });

  const { data: includedRaw = [] } = useQuery({
    queryKey: ['admin-cl-commits', 'included'],
    queryFn:  () => changelogApi.listCommits('included'),
  });
  const includedWithoutEntry = (includedRaw as ChangelogCommit[]).filter((c) => !c.entryId).length;

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ['admin-cl-commits'] });
    qc.invalidateQueries({ queryKey: ['changelog-pending-count'] });
  }

  const importMutation = useMutation({
    mutationFn: changelogApi.importCommits,
    onSuccess: (result) => { setImportMsg(result); invalidateAll(); },
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: 'included' | 'skipped' }) =>
      decision === 'included' ? changelogApi.includeCommit(id) : changelogApi.skipCommit(id),
    onSuccess: invalidateAll,
  });

  const bulkMutation = useMutation({
    mutationFn: (p: { filter: 'non-technical' | 'technical' | 'all'; decision: 'included' | 'skipped' }) =>
      changelogApi.bulkDecide(p.filter, p.decision),
    onSuccess: invalidateAll,
  });

  const draftMutation = useMutation({
    mutationFn: changelogApi.buildDraft,
    onSuccess: () => {
      invalidateAll();
      qc.invalidateQueries({ queryKey: ['admin-changelog'] });
      qc.invalidateQueries({ queryKey: ['changelog'] });
      onDraftCreated();
    },
  });

  const allCommits    = commits as ChangelogCommit[];
  const pendingCount2 = allCommits.filter((c) => c.status === 'pending').length;
  const nonTechPending= allCommits.filter((c) => c.status === 'pending' && !c.isTechnical).length;

  return (
    <div className="space-y-4">
      {/* Import-Leiste */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => importMutation.mutate()}
          disabled={importMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {importMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Neue Commits importieren
        </button>

        {importMsg && (
          <span className="text-xs text-gray-500">
            {importMsg.imported > 0
              ? <><span className="text-green-600 font-medium">{importMsg.imported} neu</span>{', '}{importMsg.skippedExisting} bereits bekannt</>
              : <span className="text-gray-400">Alle Commits bereits bekannt</span>
            }
            {importMsg.deployTag && <span className="ml-1 text-gray-300">{' · '}{importMsg.deployTag}</span>}
          </span>
        )}

        {includedWithoutEntry > 0 && (
          <button
            onClick={() => draftMutation.mutate()}
            disabled={draftMutation.isPending}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {draftMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Entwurf aus {includedWithoutEntry} Commit{includedWithoutEntry !== 1 ? 's' : ''} erstellen
          </button>
        )}
      </div>

      {/* Filter + Bulk-Aktionen */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['pending', 'included', 'skipped'] as CommitFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s === 'pending' ? 'Ausstehend' : s === 'included' ? 'Aufgenommen' : 'Übersprungen'}
            </button>
          ))}
        </div>

        {filter === 'pending' && pendingCount2 > 0 && (
          <div className="flex gap-1.5">
            <button
              onClick={() => bulkMutation.mutate({ filter: 'technical', decision: 'skipped' })}
              disabled={bulkMutation.isPending}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              <Zap className="w-3 h-3" />
              Technische überspringen
            </button>
            {nonTechPending > 0 && (
              <button
                onClick={() => bulkMutation.mutate({ filter: 'non-technical', decision: 'included' })}
                disabled={bulkMutation.isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
              >
                <ListChecks className="w-3 h-3" />
                Alle {nonTechPending} aufnehmen
              </button>
            )}
          </div>
        )}
      </div>

      {/* Commit-Liste */}
      {isLoading ? <Spinner /> : allCommits.length === 0 ? (
        <Empty text={
          filter === 'pending'
            ? 'Keine ausstehenden Commits. Klicke auf "Neue Commits importieren".'
            : filter === 'included' ? 'Noch keine Commits aufgenommen.'
            : 'Noch keine Commits übersprungen.'
        } />
      ) : (
        <div className="space-y-2">
          {allCommits.map((commit) => (
            <CommitRow
              key={commit.id}
              commit={commit}
              onDecide={(decision) => decideMutation.mutate({ id: commit.id, decision })}
              isPending={decideMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommitRow({
  commit, onDecide, isPending,
}: {
  commit: ChangelogCommit;
  onDecide: (d: 'included' | 'skipped') => void;
  isPending: boolean;
}) {
  const isTech = !!commit.isTechnical;
  const isDone = commit.status !== 'pending';

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
      commit.status === 'included'  ? 'border-green-100 bg-green-50/40'
      : commit.status === 'skipped' ? 'border-gray-100 bg-gray-50/60 opacity-60'
      : isTech                      ? 'border-orange-100 bg-orange-50/30'
      :                               'border-gray-100 bg-white hover:border-gray-200'
    }`}>
      <div className="mt-0.5 shrink-0 w-5 flex justify-center">
        {commit.status === 'included' ? <Check     className="w-4 h-4 text-green-500" />
        : commit.status === 'skipped' ? <X         className="w-4 h-4 text-gray-400" />
        : isTech                      ? <Zap       className="w-3.5 h-3.5 text-orange-400" />
        :                               <GitCommit className="w-3.5 h-3.5 text-gray-300" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${commit.status === 'skipped' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
          {commit.message}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[11px] font-mono text-gray-300">{commit.shortHash}</span>
          <span className="text-[11px] text-gray-400">{fmtDate(commit.commitDate)}</span>
          {commit.author && <span className="text-[11px] text-gray-400">{commit.author}</span>}
          {isTech && commit.status === 'pending' && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-600">Technisch</span>
          )}
          {commit.entryId && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-50 text-brand-600">Eintrag #{commit.entryId}</span>
          )}
        </div>
      </div>

      {!isDone && (
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onDecide('included')} disabled={isPending} title="Aufnehmen"
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Aufnehmen</span>
          </button>
          <button
            onClick={() => onDecide('skipped')} disabled={isPending} title="Überspringen"
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Überspringen</span>
          </button>
        </div>
      )}

      {isDone && (
        <button
          onClick={() => onDecide(commit.status === 'included' ? 'skipped' : 'included')}
          disabled={isPending} title="Entscheidung umkehren"
          className="shrink-0 p-1 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Einträge-Verwaltung ───────────────────────────────────────────────────────

function EntriesTab() {
  const qc = useQueryClient();
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId,   setEditingId]   = useState<number | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['admin-changelog'],
    queryFn:  changelogApi.listAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => changelogApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-changelog'] }),
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, published }: { id: number; published: boolean }) =>
      published ? changelogApi.unpublish(id) : changelogApi.publish(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-changelog'] });
      qc.invalidateQueries({ queryKey: ['changelog'] });
    },
  });

  function afterSave() {
    qc.invalidateQueries({ queryKey: ['admin-changelog'] });
    qc.invalidateQueries({ queryKey: ['changelog'] });
    setShowNewForm(false);
    setEditingId(null);
  }

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {entries.length} {entries.length === 1 ? 'Eintrag' : 'Einträge'}
          {(entries as ChangelogEntry[]).filter((e) => e.isPublished).length > 0 && (
            <> · <span className="text-green-600">
              {(entries as ChangelogEntry[]).filter((e) => e.isPublished).length} veröffentlicht
            </span></>
          )}
        </p>
        {!showNewForm && (
          <button
            onClick={() => { setShowNewForm(true); setEditingId(null); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl bg-brand-500 text-white hover:bg-brand-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Manueller Eintrag
          </button>
        )}
      </div>

      {showNewForm && <ChangelogForm onSave={afterSave} onCancel={() => setShowNewForm(false)} />}

      {entries.length === 0 && !showNewForm ? (
        <Empty text='Noch keine Einträge. Commits überprüfen und Entwurf erstellen.' />
      ) : (
        <div className="space-y-3">
          {(entries as ChangelogEntry[]).map((entry) =>
            editingId === entry.id ? (
              <ChangelogForm
                key={entry.id} entry={entry}
                onSave={afterSave} onCancel={() => setEditingId(null)}
              />
            ) : (
              <div
                key={entry.id}
                className={`bg-white rounded-2xl border p-4 ${entry.isPublished ? 'border-green-100' : 'border-dashed border-gray-200'}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {entry.version && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700 border border-brand-100">
                          v{entry.version}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{fmtDate(entry.releaseDate)}</span>
                      {entry.isPublished
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700">Veröffentlicht</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600">Entwurf</span>
                      }
                    </div>
                    <p className="font-semibold text-gray-900 text-sm mb-1">{entry.title}</p>
                    {entry.body && (
                      <p className="text-xs text-gray-400 line-clamp-3 whitespace-pre-wrap leading-relaxed">{entry.body}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => publishMutation.mutate({ id: entry.id, published: !!entry.isPublished })}
                      disabled={publishMutation.isPending}
                      title={entry.isPublished ? 'Zurück auf Entwurf' : 'Veröffentlichen'}
                      className={`p-1.5 rounded-lg transition-colors ${entry.isPublished ? 'text-green-500 hover:bg-green-50' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-600'}`}
                    >
                      {entry.isPublished ? <CheckCircle className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => { setEditingId(entry.id); setShowNewForm(false); }}
                      title="Bearbeiten"
                      className="p-1.5 rounded-lg text-gray-300 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Eintrag "${entry.title}" wirklich löschen?`)) deleteMutation.mutate(entry.id);
                      }}
                      disabled={deleteMutation.isPending} title="Löschen"
                      className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Formular ─────────────────────────────────────────────────────────────────

function ChangelogForm({ entry, onSave, onCancel }: {
  entry?: ChangelogEntry; onSave: () => void; onCancel: () => void;
}) {
  const isEdit  = entry !== undefined;
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [form, setForm] = useState<ChangelogFormData>(() =>
    isEdit ? {
      version:     entry.version     ?? '',
      releaseDate: entry.releaseDate ?? new Date().toISOString().slice(0, 10),
      title:       entry.title       ?? '',
      body:        entry.body        ?? '',
      isPublished: !!entry.isPublished,
    } : { ...EMPTY_FORM }
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        version:     form.version.trim() || null,
        gitHash:     (isEdit ? entry?.gitHash : null) ?? null,
        isPublished: form.isPublished ? 1 : 0,
      } as Parameters<typeof changelogApi.create>[0];
      return isEdit ? changelogApi.update(entry!.id, payload) : changelogApi.create(payload);
    },
    onSuccess: onSave,
  });

  const set = (k: keyof ChangelogFormData, v: string | boolean) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="bg-white rounded-2xl border border-brand-200 p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{isEdit ? 'Eintrag bearbeiten' : 'Manueller Eintrag'}</h3>
        <button onClick={onCancel} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Datum *</label>
          <input type="date" value={form.releaseDate} onChange={(e) => set('releaseDate', e.target.value)} className="input w-full text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Version <span className="font-normal opacity-60">(optional)</span></label>
          <input type="text" value={form.version} onChange={(e) => set('version', e.target.value)} placeholder="z.B. 1.5.0" className="input w-full text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Titel *</label>
        <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Was ist neu?" className="input w-full text-sm" />
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Änderungen</label>
        <textarea
          ref={bodyRef} value={form.body} onChange={(e) => set('body', e.target.value)}
          rows={6} placeholder={"• Neue Funktion XY\n• Fehler behoben"}
          className="input resize-y w-full text-sm font-mono"
        />
        <p className="text-xs text-gray-400 mt-1">Eine Zeile pro Änderung, z.B. mit „•" am Anfang.</p>
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input type="checkbox" checked={form.isPublished} onChange={(e) => set('isPublished', e.target.checked)}
          className="rounded border-gray-300 text-green-500 focus:ring-green-400" />
        <span className="text-sm text-gray-700">
          Sofort veröffentlichen
          {!form.isPublished && <span className="ml-1.5 text-xs text-gray-400">(als Entwurf)</span>}
        </span>
        {form.isPublished ? <Globe className="w-3.5 h-3.5 text-green-500" /> : <EyeOff className="w-3.5 h-3.5 text-gray-300" />}
      </label>

      {saveMutation.isError && (
        <p className="text-sm text-red-500">
          {(saveMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Fehler beim Speichern'}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="btn-secondary flex-1" disabled={saveMutation.isPending}>Abbrechen</button>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !form.title.trim() || !form.releaseDate}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-40 transition-colors"
        >
          {saveMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Speichert…</> : isEdit ? 'Speichern' : 'Erstellen'}
        </button>
      </div>
    </div>
  );
}

// ── Hilfsfunktionen & Mini-Komponenten ───────────────────────────────────────

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-100">
      <p className="text-sm">{text}</p>
    </div>
  );
}
