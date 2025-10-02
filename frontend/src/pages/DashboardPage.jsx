// frontend/src/pages/DashboardPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

function Card({ title, children }) {
  return (
    <div className="app-card" style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <h3 style={{ margin:0, fontWeight:700, fontSize:'clamp(.95rem,1.2vw + .45rem,1.2rem)' }}>{title}</h3>
      {children}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ background:'#f8fafd', padding:'10px 12px', borderRadius:10, boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
      <div style={{ fontSize:12, color:'#666' }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:700, color:'#222' }}>{value}</div>
    </div>
  );
}

function toCurrencyBRL(n) { try { return (Number(n)||0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' }); } catch { return `${Number(n)||0}`; } }
function toNumber(n) { return (Number(n)||0).toLocaleString('pt-BR'); }

export default function DashboardPage(){
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [range, setRange] = useState({ preset: '90', start: '', end: '' }); // presets: 30,90,365,custom

  useEffect(()=>{
    let mounted = true;
    (async ()=>{
      try {
        setLoading(true);
        let url = `${API_BASE}/api/dashboard`;
        const params = new URLSearchParams();
        if (range.preset === 'custom' && range.start && range.end) {
          params.set('start', range.start);
          params.set('end', range.end);
        } else {
          // translate presets to months
          const months = range.preset === '30' ? 1 : range.preset === '90' ? 3 : 12;
          params.set('months', String(months));
        }
        url += `?${params.toString()}`;
        const res = await axios.get(url);
        if(mounted) setData(res.data);
      } catch(e){
        if(mounted) setError('Não foi possível carregar o dashboard.');
      } finally {
        if(mounted) setLoading(false);
      }
    })();
    return ()=>{ mounted = false; };
  }, [range]);

  const monthlySeries = useMemo(()=>{
    if(!data?.monthly) return [];
    return data.monthly.map(m => ({ month: m.month, brl: Number(m.brl_converted_total||0) }));
  }, [data]);

  const maxBrl = Math.max(1, ...monthlySeries.map(m=>m.brl));

  return (
    <div style={{ background: 'var(--background-default, #181c24)', minHeight: '100vh', padding: '32px 0' }}>
      <div style={{ maxWidth:'1200px', margin:'0 auto', padding:'0 20px', display:'flex', flexDirection:'column', gap:20 }}>
        <h2 style={{ margin:0, fontWeight:700, fontSize:'clamp(1.1rem,2vw+0.4rem,1.5rem)' }}>Dashboard</h2>
        {/* Controles de período */}
        <div style={{ display:'flex', gap:10, alignItems:'end', flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:6 }}>
            {['30','90','365'].map(p => (
              <button key={p} className="btn" onClick={()=>setRange({ preset:p, start:'', end:'' })} style={{ padding:'6px 10px', background: range.preset===p ? '#4f6bf0' : '#334155', color:'#fff', borderColor:'transparent' }}>
                {p==='30'?'30 dias':p==='90'?'90 dias':'12 meses'}
              </button>
            ))}
            <button className="btn" onClick={()=>setRange(r => ({ ...r, preset:'custom' }))} style={{ padding:'6px 10px', background: range.preset==='custom' ? '#4f6bf0' : '#334155', color:'#fff', borderColor:'transparent' }}>Personalizado</button>
          </div>
          {range.preset==='custom' && (
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <div>
                <label style={{ display:'block', fontSize:12, color:'#cbd5e1' }}>Início</label>
                <input type="date" className="themed-input" value={range.start} onChange={e=>setRange(r=>({ ...r, start:e.target.value }))} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:12, color:'#cbd5e1' }}>Fim</label>
                <input type="date" className="themed-input" value={range.end} onChange={e=>setRange(r=>({ ...r, end:e.target.value }))} />
              </div>
              <button className="btn btn-primary" onClick={()=>setRange(r=>({ ...r }))} disabled={!range.start || !range.end}>Aplicar</button>
            </div>
          )}
        </div>
        {loading && <div>Carregando...</div>}
        {error && <div style={{ color:'tomato' }}>{error}</div>}
        {!loading && !error && data && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12 }}>
              <MiniStat label="Navios" value={toNumber(data.summary.ships)} />
              <MiniStat label="Clientes" value={toNumber(data.summary.clients)} />
              <MiniStat label="Portos" value={toNumber(data.summary.ports)} />
              <MiniStat label="Serviços" value={toNumber(data.summary.services)} />
              <MiniStat label="PDAs" value={toNumber(data.summary.pdas)} />
              <MiniStat label="Total 90d (BRL)" value={toCurrencyBRL(data.summary.totals.brl_converted_total)} />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1.4fr .8fr', gap:16 }}>
              <Card title="Faturamento Mensal (BRL convertido)">
                <div style={{ background:'#f8fafd', borderRadius:10, padding:12 }}>
                  {/* Gráfico de barras simples em SVG */}
                  <svg viewBox={`0 0 ${monthlySeries.length*40} 120`} style={{ width:'100%', height:200 }}>
                    {monthlySeries.map((p, i) => {
                      const h = Math.max(2, Math.round((p.brl / maxBrl) * 100));
                      const x = i*40 + 10;
                      const y = 110 - h;
                      return (
                        <g key={p.month}>
                          <rect x={x} y={y} width={22} height={h} fill="#4f6bf0" rx={4} />
                          <text x={x+11} y={115} textAnchor="middle" fontSize="8" fill="#333">{p.month.slice(2)}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </Card>

              <Card title="Top Clientes (12m)">
                <div style={{ maxHeight:260, overflow:'auto' }}>
                  <table className="table-basic" style={{ background:'#f8fafd' }}>
                    <thead><tr><th>Cliente</th><th>Total (BRL)</th></tr></thead>
                    <tbody>
                      {(data.topClients||[]).map(row => (
                        <tr key={row.id}><td>{row.name}</td><td>{toCurrencyBRL(row.total_brl)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              <Card title="Top Portos (12m)">
                <div style={{ maxHeight:260, overflow:'auto' }}>
                  <table className="table-basic" style={{ background:'#f8fafd' }}>
                    <thead><tr><th>Porto</th><th>Total (BRL)</th></tr></thead>
                    <tbody>
                      {(data.topPorts||[]).map(row => (
                        <tr key={row.id}><td>{row.name}</td><td>{toCurrencyBRL(row.total_brl)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card title="Últimas PDAs">
                <div style={{ maxHeight:260, overflow:'auto' }}>
                  <table className="table-basic" style={{ background:'#f8fafd' }}>
                    <thead><tr><th>PDA</th><th>Cliente</th><th>Navio</th><th>Porto</th></tr></thead>
                    <tbody>
                      {(data.recentPdas||[]).map(p => (
                        <tr key={p.id}><td>{p.pda_number}</td><td>{p.client_name}</td><td>{p.ship_name}</td><td>{p.port_name}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
