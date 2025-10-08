import { useContext, useMemo } from 'react';
import AuthContext from '../context/AuthContext.jsx';

export default function Topbar({ onMenuClick }) {
  const { settings } = useContext(AuthContext);
  // Tenta pegar nome da empresa; fallback vazio
  const { companyName, acronym } = useMemo(() => {
    const c = settings?.company || {};
    const name = c.name || settings?.companyName || '';
    // Tenta vários campos para sigla
    const acr = (c.acronym || c.sigla || c.abbr || c.code || c.shortName || settings?.companyAcronym || '')?.toString().trim();
    return { companyName: name?.toString().trim(), acronym: acr };
  }, [settings]);

  let title;
  if (companyName) {
    const lowerName = companyName.toLowerCase();
    if (acronym && !lowerName.includes(acronym.toLowerCase())) {
      // Formato: PDA System - SIGLA - Nome Completo
      title = `PDA System - ${acronym} - ${companyName}`;
    } else {
      title = `PDA System - ${companyName}`;
    }
  } else if (acronym) {
    title = `PDA System - ${acronym}`;
  } else {
    title = 'PDA System';
  }
  return (
    <header className="ss-topbar">
      <button
        type="button"
        className="ss-mobile-trigger"
        aria-label="Abrir menu"
        onClick={onMenuClick}
      >☰</button>
  <div className="ss-topbar-title" title={title} style={{ textTransform:'uppercase' }}>{title.toUpperCase()}</div>
      <div className="ss-topbar-right" />
    </header>
  );
}
