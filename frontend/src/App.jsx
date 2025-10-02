// frontend/src/App.jsx
import React, { useContext, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ShipsPage from './pages/ShipsPage';
import ClientsPage from './pages/ClientsPage';
import PortsPage from './pages/PortsPage';
import ServicePage from './pages/ServicePage';
import PortServicesPage from './pages/PortServicesPage';
import CalculationsPage from './pages/CalculationsPage';
import PortRemarksPage from './pages/PortRemarksPage';
import PdasPage from './pages/PdasPage';
import PilotagePage from './pages/PilotagePage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import RequireAdmin from './components/RequireAdmin';
import Layout from './components/Layout';
// (import duplicado removido)
import AuthContext from './context/AuthContext';

function RequireTab({ tabKey, children }) {
  const { settings, settingsReady, user } = React.useContext(AuthContext);
  // Enquanto não carregou as permissões, não renderiza nada para evitar flash
  if (!settingsReady) return <div style={{ padding:32 }}>Carregando permissões...</div>;
  const isAdmin = (settings?.is_admin || user?.role?.toLowerCase() === 'admin');
  if (isAdmin) return children;
  const allowed = settings?.visible_tabs?.[tabKey] === true;
  if (!allowed) return <Navigate to="/pda" replace />;
  return children;
}


function ProtectedRoutes() {
  return (
    <Route element={<Layout />}>
  <Route path="/pda" element={<RequireTab tabKey="pda"><PdasPage /></RequireTab>} />
      {/* root PDA deve sempre estar permitido se pda = true ou admin */}
  <Route path="/ships" element={<RequireTab tabKey="ships"><ShipsPage /></RequireTab>} />
  <Route path="/clients" element={<RequireTab tabKey="clients"><ClientsPage /></RequireTab>} />
  <Route path="/ports" element={<RequireTab tabKey="ports"><PortsPage /></RequireTab>} />
  <Route path="/services" element={<RequireTab tabKey="services"><ServicePage /></RequireTab>} />
  <Route path="/pilotage" element={<RequireTab tabKey="pilotage"><PilotagePage /></RequireTab>} />
  <Route path="/port-services" element={<RequireTab tabKey="port_services"><PortServicesPage /></RequireTab>} />
  <Route path="/calculations" element={<RequireTab tabKey="calculations"><CalculationsPage /></RequireTab>} />
  <Route path="/port-remarks" element={<RequireTab tabKey="port_remarks"><PortRemarksPage /></RequireTab>} />
  <Route path="/profile" element={<RequireTab tabKey="profile"><ProfilePage /></RequireTab>} />
  <Route path="/admin" element={<RequireAdmin><RequireTab tabKey="admin"><AdminPage /></RequireTab></RequireAdmin>} />
    <Route path="/dashboard" element={<RequireTab tabKey="dashboard"><DashboardPage /></RequireTab>} />
    </Route>
  );
}

function App() {
  const { user, logout } = useContext(AuthContext);
  // Detect base path at runtime to support hosting under /sistema without requiring env
  const computedBase = (() => {
    const base = import.meta.env.BASE_URL || '/';
    if (base && base !== '/') return base;
    // Heuristic: if app is served under /sistema, keep routing there
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/sistema')) {
      return '/sistema/';
    }
    return '/';
  })();

  return (
    <BrowserRouter basename={computedBase}>
      <Routes>
        {/* Se já estiver logado e acessar /login, redireciona para /pda */}
        <Route path="/login" element={user ? <Navigate to="/pda" replace /> : <LoginPage />} />
        {/* Rota de logout que executa o logout e redireciona */}
        <Route
          path="/logout"
          element={
            <LogoutRoute onLogout={logout} />
          }
        />
        {user ? (
          <>
            {ProtectedRoutes()}
            <Route path="/" element={<Navigate to="/pda" replace />} />
          </>
        ) : (
          <>
            <Route path="/*" element={<Navigate to="/login" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;

// Pequeno componente de rota para efetivar o logout e redirecionar
function LogoutRoute({ onLogout }) {
  useEffect(() => {
    try { onLogout?.(); } catch {}
  }, [onLogout]);
  return <Navigate to="/login" replace />;
}