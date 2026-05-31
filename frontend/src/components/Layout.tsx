import { Outlet, NavLink, Link } from 'react-router-dom';
import { BookOpen, Plus, Search, HelpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { accountApi } from '../api/client';

export default function Layout() {
  const { user } = useAuth();

  // Badge: Anzahl offener eingehender Verknüpfungsanfragen
  const { data: links = [] } = useQuery({
    queryKey: ['account-links'],
    queryFn:  accountApi.getLinks,
    refetchInterval: 60_000,
  });
  const pendingIncoming = links.filter(
    (l) => l.direction === 'incoming' && l.status === 'pending'
  ).length;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Logo */}
          <NavLink
            to="/"
            className="flex items-center gap-2 font-semibold text-gray-900 hover:text-brand-600 transition-colors shrink-0"
          >
            <BookOpen className="w-5 h-5 text-brand-500" />
            <span className="hidden sm:inline">Rezeptsammlung</span>
          </NavLink>

          {/* Nav-Links */}
          <nav className="flex items-center gap-1 flex-1 justify-end">
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

            {/* Profil-Avatar → Profilseite */}
            <Link
              to="/profil"
              className="relative ml-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              title="Profil & Einstellungen"
            >
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-8 h-8 rounded-full ring-2 ring-transparent hover:ring-brand-300 transition"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-sm font-semibold text-brand-700 hover:bg-brand-200 transition">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
              )}
              {/* Badge: offene Verknüpfungsanfragen */}
              {pendingIncoming > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center pointer-events-none">
                  {pendingIncoming}
                </span>
              )}
            </Link>
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
          Anleitung
        </NavLink>
      </footer>
    </div>
  );
}
