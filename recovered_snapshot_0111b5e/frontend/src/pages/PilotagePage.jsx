// frontend/src/pages/PilotagePage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';
import { TextField } from '@mui/material';

function PilotagePage() {
  const [tariffs, setTariffs] = useState([]);
  const [ports, setPorts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Para o formulário de criação/edição de Tabela
  const [form, setForm] = useState({ id: null, name: '', tag_name: '', basis: 'GRT', pu_formula: '', port_id: '' });
  const [isEditing, setIsEditing] = useState(false);

  // Para gerenciar as faixas da tabela selecionada
  const [selectedTariffId, setSelectedTariffId] = useState(null);
  const [ranges, setRanges] = useState([]);
  
  const fetchTariffs = async () => {
    try {
      const [tariffsRes, portsRes] = await Promise.all([
  axios.get(`${API_BASE}/api/pilotage/tariffs`),
  axios.get(`${API_BASE}/api/ports`)
      ]);
      setTariffs(tariffsRes.data);
      setPorts(portsRes.data);
    } catch (error) { console.error("Erro ao buscar dados", error); } finally { setLoading(false); }
  };

  useEffect(() => { fetchTariffs(); }, []);

  useEffect(() => {
    if (!selectedTariffId) { setRanges([]); return; }
    const fetchRanges = async () => {
      try {
  const res = await axios.get(`${API_BASE}/api/pilotage/tariffs/${selectedTariffId}/ranges`);
        setRanges(res.data.length > 0 ? res.data : [{ range_start: '', range_end: '', value: '' }]);
      } catch (error) { console.error("Erro ao buscar faixas", error); }
    };
    fetchRanges();
  }, [selectedTariffId]);

  const handleFormChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); };
  
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
  await axios.post(`${API_BASE}/api/pilotage/tariffs`, form);
      alert('Tabela salva com sucesso!');
      handleCancelEdit();
      fetchTariffs();
    } catch (error) { alert(error.response?.data?.error || "Erro ao salvar tabela."); }
  };
  
  const handleEditClick = (tariff) => {
    setForm({ id: tariff.id, name: tariff.name, tag_name: tariff.tag_name, basis: tariff.basis, pu_formula: tariff.pu_formula || '', port_id: tariff.port_id });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setForm({ id: null, name: '', tag_name: '', basis: 'GRT', pu_formula: '', port_id: '' });
    setIsEditing(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir esta tabela e todas as suas faixas?")) {
      try {
        await axios.delete(`${API_BASE}/api/pilotage/tariffs/${id}`);
        fetchTariffs();
      } catch (error) { alert("Erro ao excluir tabela."); }
    }
  };

  const handleRangeChange = (index, field, value) => {
    const newRanges = [...ranges];
    newRanges[index][field] = value;
    setRanges(newRanges);
  };

  const addRange = () => { setRanges([...ranges, { range_start: '', range_end: '', value: '' }]); };
  const removeRange = (index) => { setRanges(ranges.filter((_, i) => i !== index)); };

  const handleSaveRanges = async () => {
    try {
      await axios.post(`${API_BASE}/api/pilotage/tariffs/${selectedTariffId}/ranges`, { ranges });
      alert("Faixas salvas com sucesso!");
    } catch (error) { alert("Erro ao salvar faixas."); }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div style={{ padding: '32px 0', background: 'var(--background-default, #181c24)', minHeight:'100vh' }}>
      <div style={{ maxWidth:'1200px', margin:'0 auto', padding:'0 20px' }}>
        <h2 style={{ color: 'var(--mui-primary, #6ec1e4)', marginBottom: 24, fontSize:'clamp(1.2rem,2.4vw+0.4rem,1.8rem)' }}>Tabelas de Praticagem</h2>
        <div className="app-card" style={{ marginBottom:32 }}>
          <h3 style={{ color: '#222', marginBottom: 16 }}>{isEditing ? 'Editando Tabela' : 'Criar Nova Tabela'}</h3>
          <form onSubmit={handleFormSubmit} className="app-form-grid" style={{ marginTop:0 }}>
            <input className="themed-input" name="name" placeholder="Nome da Tabela *" value={form.name} onChange={handleFormChange} required />
            <input className="themed-input" name="tag_name" placeholder="TAG (Ex: @praticagemRJ)" value={form.tag_name} onChange={handleFormChange} required />
            <select className="themed-input" name="port_id" value={form.port_id} onChange={handleFormChange} required>
              <option value="">Associar ao Porto</option>
              {ports.map(p => <option key={p.id} value={p.id}>{`${p.name} - ${p.terminal} - ${p.berth}`}</option>)}
            </select>
            <select className="themed-input" name="basis" value={form.basis} onChange={handleFormChange}>
              <option value="GRT">GRT</option>
              <option value="DWT">DWT</option>
              <option value="PU">PU</option>
            </select>
            {form.basis === 'PU' && (
              <input className="themed-input" name="pu_formula" placeholder="Fórmula da Unidade de Praticagem (PU)" value={form.pu_formula} onChange={handleFormChange} />
            )}
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <button className="header-btn" type="submit">{isEditing ? 'Salvar Alterações' : 'Criar Tabela'}</button>
              {isEditing && <button className="header-btn" type="button" onClick={handleCancelEdit}>Cancelar</button>}
            </div>
          </form>
        </div>
        <h3 style={{ color: 'var(--mui-primary, #6ec1e4)', marginBottom: 16, fontSize:'clamp(1rem,2vw+0.3rem,1.4rem)' }}>Tabelas Existentes</h3>
        {tariffs.map(tariff => (
          <div key={tariff.id} className="app-card" style={{ padding:24, marginBottom:20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap:16, flexWrap:'wrap' }}>
              <div>
                <h4 style={{ color: '#222', margin: 0 }}>{tariff.name} ({tariff.tag_name})</h4>
                <div style={{ color: '#444', fontSize: 14, marginTop: 2 }}>Porto: {tariff.port_name} - {tariff.port_terminal} | Base: {tariff.basis}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap:'wrap' }}>
                <button className="header-btn" onClick={() => setSelectedTariffId(selectedTariffId === tariff.id ? null : tariff.id)}>{selectedTariffId === tariff.id ? 'Fechar Faixas' : 'Faixas'}</button>
                <button className="header-btn" onClick={() => handleEditClick(tariff)}>Editar</button>
                <button className="header-btn" style={{ color: '#d32f2f', background: '#fff0f0' }} onClick={() => handleDelete(tariff.id)}>Excluir</button>
              </div>
            </div>
            {selectedTariffId === tariff.id && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Faixas de Valor</div>
                {ranges.map((range, index) => (
                  <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap:'wrap' }}>
                    <input className="themed-input" type="number" placeholder="De" value={range.range_start} onChange={e => handleRangeChange(index, 'range_start', e.target.value)} style={{ flex: 1, minWidth:110 }} />
                    <input className="themed-input" type="number" placeholder="Até" value={range.range_end} onChange={e => handleRangeChange(index, 'range_end', e.target.value)} style={{ flex: 1, minWidth:110 }} />
                    <input className="themed-input" type="number" placeholder="Valor" value={range.value} onChange={e => handleRangeChange(index, 'value', e.target.value)} style={{ flex: 1, minWidth:110 }} />
                    <button className="header-btn" style={{ color: '#d32f2f', background: '#fff0f0', minWidth:0 }} type="button" onClick={() => removeRange(index)}>X</button>
                  </div>
                ))}
                <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:12 }}>
                  <button className="header-btn" type="button" onClick={addRange}>+ Faixa</button>
                  <button className="header-btn" type="button" onClick={handleSaveRanges}>Salvar Faixas</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PilotagePage;