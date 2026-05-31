import { Outlet, NavLink } from 'react-router-dom';
import { BookOpen, Plus, Search, HelpCircle, LogOut, Link2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { accountApi } from '../api/client';

export default function Layout() {
  const { user, logout } = useAuth();

  // Anzahl offener Verknüpfungsanfragen für Badge
  const { data: links = [] } = useQuery({
    queryKey: ['account-links'],
    queryFn:  accountApi.getLinks,
    refetchInterval: 60_000,
  });
  const pendingIncoming = links.filter((l) => l.direction === 'incoming' && l.status === 'pending').length;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2 font-semibold text-gray-900 hover:text-brand-600 transition-colors">
            <BookOpen className="w-5 h-5 text-brand-500" />
            <span>Rezeptsammlung</span>
          </NavLink>

          <nav className="flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`
              }
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Rezepte</span>
            </NavLink>
            <NavLink
              to="/import"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`
              }
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Importieren</span>
            </NavLink>
            <NavLink
              to="/anleitung"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`
              }
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Anleitung</span>
            </NavLink>
            <NavLink
              to="/konten"
              className={({ isActive }) =>
                `relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`
              }
              title="Verknüpfte Konten"
            >
              <Link2 className="w-4 h-4" />
              <span className="hidden sm:inline">Konten</span>
              {pendingIncoming > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {pendingIncoming}
                </span>
              )}
            </NavLink>

            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-100">
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-7 h-7 rounded-full"
                  title={user.name}
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-xs font-semibold text-brand-700">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <button
                onClick={logout}
                title="Abmelden"
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Abmelden</span>
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        Meine Rezeptsammlung
        {' · '}
        <NavLink to="/anleitung" className="underline hover:text-gray-600 transition-colors">
          Anleitung (iPhone / iPad &amp; Android)
        </NavLink>
      </footer>
    </div>
  );
}
