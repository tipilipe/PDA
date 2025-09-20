// frontend/src/App.jsx
import React, { useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import AuthContext from './context/AuthContext';

import LoginPage from './pages/LoginPage';
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


function DashboardLayout() {
  const { logout, settings, user } = useContext(AuthContext);
  const location = useLocation();
  const navStyle = { backgroundColor: 'transparent', padding: 0, marginBottom: 0, borderBottom: 'none', display: 'flex', alignItems: 'center' };
  const linkContainerStyle = { display: 'flex', gap: '6px', flexWrap: 'wrap' };

  // Map de rotas para facilitar o match
  const navLinksAll = [
    { to: '/pda', label: '★ Gerar PDA' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/ships', label: 'Navios' },
    { to: '/clients', label: 'Clientes' },
    { to: '/ports', label: 'Portos' },
    { to: '/services', label: 'Serviços' },
    { to: '/pilotage', label: 'Praticagem' },
    { to: '/port-services', label: 'Vínculos' },
    { to: '/calculations', label: 'Cálculos' },
    { to: '/port-remarks', label: 'Observações' },
    { to: '/profile', label: 'Perfil' },
    { to: '/admin', label: 'Administração' },
  ];

  const role = (user?.role || '').toLowerCase();
  const allowAll = role === 'admin' || role === 'superadmin' || settings?.is_admin === true;
  const canSee = (to) => {
    if (allowAll) return true;
    const key = to.replace(/^\//, '').replace(/-/g, '_');
    const vis = settings?.visible_tabs || {};
    if (!key) return false;
    return vis[key] === true; // somente abas explicitamente true
  };
  const navLinks = navLinksAll.filter(l => canSee(l.to));

  return (
    <div>
      <nav style={navStyle}>
        <div style={linkContainerStyle}>
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`header-btn btn btn-primary${location.pathname.startsWith(link.to) ? ' active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
  <button onClick={logout} className="header-btn btn btn-outline-danger sair">Sair</button>
      </nav>
      <main style={{ padding: '0 20px' }}>
        <Routes>
          <Route path="/pda" element={<PdasPage />} />
          <Route path="/ships" element={<ShipsPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/ports" element={<PortsPage />} />
          <Route path="/services" element={<ServicePage />} />
          <Route path="/pilotage" element={<PilotagePage />} />
          <Route path="/port-services" element={<PortServicesPage />} />
          <Route path="/calculations" element={<CalculationsPage />} />
          <Route path="/port-remarks" element={<PortRemarksPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
          <Route path="/" element={<Navigate to="/pda" />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const { user } = useContext(AuthContext);
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <div className="no-print">
        {user ? (
          <DashboardLayout />
        ) : (
          <Routes>
            <Route path="*" element={<LoginPage />} />
          </Routes>
        )}
      </div>
    </BrowserRouter>
  );
}

export default App;