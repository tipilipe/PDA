import { useState, useCallback } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { Outlet } from 'react-router-dom';

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const openMenu = useCallback(() => setMobileOpen(true), []);
  const closeMenu = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="ss-layout">
      <Sidebar mobileOpen={mobileOpen} onClose={closeMenu} />
      <div className="ss-content">
        <Topbar onMenuClick={openMenu} />
        {mobileOpen && <div className="ss-backdrop" onClick={closeMenu} />}
        <main className="ss-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
