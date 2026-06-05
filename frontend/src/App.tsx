import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ImportPage from './pages/ImportPage';
import RecipeDetailPage from './pages/RecipeDetailPage';
import EditRecipePage from './pages/EditRecipePage';
import AnleitungPage from './pages/AnleitungPage';
import LoginPage from './pages/LoginPage';
import SharedRecipePage from './pages/SharedRecipePage';
import ProfilePage from './pages/ProfilePage';
import InvitationPage from './pages/InvitationPage';
import AdminPage from './pages/AdminPage';
import ChangelogPage from './pages/ChangelogPage';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* Öffentlich: Rezept-Vorschau und Einladungs-Landingpage */}
        <Route path="/teilen/:token"    element={<SharedRecipePage />} />
        <Route path="/einladung/:token" element={<InvitationPage />} />
        {/* Bewahrt den Ziel-Pfad (inkl. Query-Params) damit Share-Target-URLs
            nach dem Google-Login erhalten bleiben. */}
        <Route path="*" element={<RedirectToLogin />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Geteiltes Rezept und Einladung – auch für eingeloggte Nutzer zugänglich */}
      <Route path="/teilen/:token"    element={<SharedRecipePage />} />
      <Route path="/einladung/:token" element={<InvitationPage />} />

      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/anleitung" element={<AnleitungPage />} />
        <Route path="/profil" element={<ProfilePage />} />
        {/* /konten leitet auf Profil weiter (Kontoverbindungen sind dort integriert) */}
        <Route path="/konten" element={<Navigate to="/profil" replace />} />
        <Route path="/rezepte/:id" element={<RecipeDetailPage />} />
        <Route path="/rezepte/:id/bearbeiten" element={<EditRecipePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/changelog" element={<ChangelogPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

/** Leitet unangemeldete Nutzer zum Login weiter und bewahrt dabei den
 *  aktuellen Pfad inkl. Query-String (wichtig für den Share-Target-Flow). */
function RedirectToLogin() {
  const location = useLocation();
  const returnTo = location.pathname + location.search;
  const target   = returnTo !== '/' && returnTo !== ''
    ? `/login?redirect=${encodeURIComponent(returnTo)}`
    : '/login';
  return <Navigate to={target} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
