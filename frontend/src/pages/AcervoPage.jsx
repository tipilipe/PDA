import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';
import { useNavigate } from 'react-router-dom';

export default function AcervoPage() {
  const [pdas, setPdas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [deletingIds, setDeletingIds] = useState([]);
  const navigate = useNavigate();

  const fetchPdas = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/pda`);
      // garante ordenação: mais recentes primeiro (server já retorna ORDER BY, mas reforçamos no cliente)
      const arr = res.data || [];
      arr.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at) : new Date(0);
        const db = b.created_at ? new Date(b.created_at) : new Date(0);
        return db - da;
      });
      setPdas(arr);
      return res.data || [];
    } catch (err) {
      console.error('Erro ao buscar PDAs:', err);
      setError('Não foi possível carregar o acervo.');
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPdas(); }, []);

  const fmtDateShort = (s) => {
    if (!s) return '';
    try {
      const d = new Date(s);
      if (isNaN(d)) return '';
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}`;
    } catch (e) { return '' }
  };

  const handleOpen = async (pdaId) => {
    // Reuse existing PDAs editor by navigating to /pda and then loading the PDA via query
    // There's already a route '/pda' with editor. We'll navigate there and use location state to pass pdaId
    navigate('/pda', { state: { openPdaId: pdaId } });
  };

  const handleDelete = async (pda) => {
    if (!window.confirm(`Tem certeza que deseja excluir a PDA "${pda.pda_number}"?`)) return;
    const id = Number(pda.id);
  const prev = [...pdas];
    setPdas(prevList => prevList.filter(p => Number(p.id) !== id));
    setDeletingIds(prev => [...prev, id]);
    try {
      await axios.delete(`${API_BASE}/api/pda/${id}`);
      await fetchPdas();
    } catch (err) {
      setPdas(prev);
      const msg = err.response?.data?.error || err.message || 'Erro ao excluir PDA.';
      alert(msg);
      console.error('Erro ao excluir PDA:', err);
    } finally {
      setDeletingIds(prev => prev.filter(i => i !== id));
    }
  };

  const filtered = pdas.filter(p => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      String(p.pda_number || '').toLowerCase().includes(q) ||
      String(p.client_name || '').toLowerCase().includes(q) ||
      String(p.ship_name || '').toLowerCase().includes(q) ||
      String(p.port_name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ background: 'var(--background-default, #181c24)', minHeight: '100vh', padding: '32px 0' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 20px' }}>
        <div className="app-card" style={{ padding: '24px', boxSizing: 'border-box', minHeight: '400px', maxHeight: '600px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ margin:0, fontWeight:700 }}>Acervo de PDAs</h2>
          <div style={{ marginTop:12, flex: 1, overflow: 'auto' }}>
            <input
              className="themed-input"
              placeholder="Pesquisar por PDA, cliente, navio ou porto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width:'100%', maxWidth:420 }}
            />
            {loading ? (
              <div style={{ textAlign: 'center', padding: 32 }}><span>Carregando...</span></div>
            ) : error ? (
              <div style={{ color: '#e53935', textAlign: 'center', padding: 32 }}>{error}</div>
            ) : (
              <div style={{ overflowX: 'auto', height: '100%' }}>
                <table className="app-table" style={{ minWidth: 900, width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ background: 'var(--background-table-header, #23283a)' }}>
                      <th style={{ width: 80, textAlign: 'left', color: '#fff', fontWeight: 600 }}>Número</th>
                      <th style={{ width: 160, textAlign: 'left', color: '#fff', fontWeight: 600 }}>Cliente</th>
                      <th style={{ width: 160, textAlign: 'left', color: '#fff', fontWeight: 600 }}>Navio</th>
                      <th style={{ width: 120, textAlign: 'left', color: '#fff', fontWeight: 600 }}>Porto</th>
                      <th style={{ width: 80, textAlign: 'center', color: '#fff', fontWeight: 600 }}>ETA</th>
                      <th style={{ width: 80, textAlign: 'center', color: '#fff', fontWeight: 600 }}>ETB</th>
                      <th style={{ width: 80, textAlign: 'center', color: '#fff', fontWeight: 600 }}>ETD</th>
                      <th style={{ width: 120, textAlign: 'center', color: '#fff', fontWeight: 600 }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(pda => (
                      <tr key={pda.id}>
                        <td className="card-fixed-cell" style={{ textAlign: 'left', verticalAlign: 'middle' }}>{pda.pda_number}</td>
                        <td className="card-fixed-cell" style={{ textAlign: 'left', verticalAlign: 'middle' }}>{pda.client_name}</td>
                        <td className="card-fixed-cell" style={{ textAlign: 'left', verticalAlign: 'middle' }}>{pda.ship_name}</td>
                        <td className="card-fixed-cell" style={{ textAlign: 'left', verticalAlign: 'middle' }}>{pda.port_name}</td>
                        <td className="card-fixed-cell" style={{ textAlign: 'center', verticalAlign: 'middle' }}>{fmtDateShort(pda.eta || pda.ETA)}</td>
                        <td className="card-fixed-cell" style={{ textAlign: 'center', verticalAlign: 'middle' }}>{fmtDateShort(pda.etb || pda.ETB)}</td>
                        <td className="card-fixed-cell" style={{ textAlign: 'center', verticalAlign: 'middle' }}>{fmtDateShort(pda.etd || pda.ETD)}</td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleOpen(pda.id)}
                              title="Abrir PDA"
                              aria-label="Abrir"
                              className="header-btn"
                              style={{ width: 36, height: 36, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v10a2 2 0 0 0 2 2h14"/><path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v0"/></svg>
                            </button>
                            <button
                              onClick={() => handleDelete(pda)}
                              title="Excluir PDA"
                              aria-label="Excluir"
                              className="header-btn"
                              style={{ width: 36, height: 36, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e53935', color: '#fff' }}
                              disabled={deletingIds.includes(Number(pda.id))}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ textAlign:'center', padding:12 }}>Nenhum resultado</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
