import { NavLink } from 'react-router-dom';
import { useContext, useMemo } from 'react';
import AuthContext from '../context/AuthContext.jsx';

export default function Sidebar({ mobileOpen = false, onClose = () => {} }) {
  const { settings, user } = useContext(AuthContext);
  const perms = settings?.visible_tabs || {};
  // Mapeia chaves de permissionamento -> rota
  const baseItems = [
    { key:'dashboard', to: '/dashboard', label: 'Dashboard' },
  { key:'pda', to: '/pda', label: 'PDA' },
  { key:'acervo', to: '/acervo', label: 'Acervo' },
    { key:'ships', to: '/ships', label: 'Navios' },
    { key:'clients', to: '/clients', label: 'Clientes' },
    { key:'ports', to: '/ports', label: 'Portos' },
    { key:'services', to: '/services', label: 'Serviços' },
    { key:'pilotage', to: '/pilotage', label: 'Praticagem' },
    { key:'port_services', to: '/port-services', label: 'Vínculos' },
    { key:'calculations', to: '/calculations', label: 'Cálculos' },
    { key:'port_remarks', to: '/port-remarks', label: 'Observações' },
    { key:'profile', to: '/profile', label: 'Perfil' },
  ];
  // Admin somente se is_admin true OU role admin
  if (settings?.is_admin || user?.role?.toLowerCase() === 'admin') {
    baseItems.push({ key:'admin', to:'/admin', label:'Administração' });
    // Adiciona LOG para admin
    baseItems.push({ key:'log', to:'/log', label:'Log de Ações' });
  }
  const items = useMemo(()=>{
    // Se não houver perms ainda (carregando), mostro só PDA e Perfil para evitar sumiço total
    if (!settings) return baseItems;
    return baseItems.filter(it => {
      // Dashboard ainda sem chave formal -> sempre se perms indefinido
      if (it.key === 'dashboard') return true;
      // Para admin, rota admin controlada pela presença no array (já adicionada acima)
      const allowed = perms[it.key];
      return allowed === true; // só mostra se explicitamente true
    });
  }, [baseItems, perms, settings]);

  return (
    <aside
      className={'ss-sidebar' + (mobileOpen ? ' is-open' : '')}
      aria-hidden={mobileOpen ? 'false' : 'true'}
      aria-label="Menu lateral"
    >
      <button
        type="button"
        className="ss-sidebar-close"
        onClick={onClose}
        aria-label="Fechar menu"
      >×</button>
      <div className="ss-brand">
        {/* Coloque LOGO.png OU LOGO.ico em frontend/public/. Tenta PNG e faz fallback para ICO. */}
        <img
          src="/LOGO.png"
          alt="SS Logo"
          onError={(e)=>{ if(!e.currentTarget.dataset.fallback){ e.currentTarget.dataset.fallback='1'; e.currentTarget.src='/LOGO.ico'; } else { e.currentTarget.style.visibility='hidden'; } }}
          style={{ width:40, height:40, objectFit:'contain', borderRadius:10, background:'#fff', padding:2 }}
        />
        <div className="ss-brand-text" style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>SS PDA</div>
      </div>

      <nav className="ss-nav">
        {items.length === 0 && <div style={{ fontSize:12, opacity:.6, padding:'4px 8px' }}>Sem abas liberadas.</div>}
        {items.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            className={({ isActive }) => 'ss-nav-item' + (isActive ? ' is-active' : '')}
            onClick={onClose}
          >
            <span>{i.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="ss-spacer" />
      <NavLink to="/logout" className="ss-logout" onClick={onClose}>Sair</NavLink>
    </aside>
  );
}
