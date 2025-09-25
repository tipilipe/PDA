// frontend/src/pages/PortRemarksPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

function PortRemarksPage() {
  const [ports, setPorts] = useState([]);
  const [selectedPortId, setSelectedPortId] = useState('');
  const [remarks, setRemarks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  axios.get(`${API_BASE}/api/ports`)
      .then(res => setPorts(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedPortId) {
      setRemarks([]);
      return;
    }
  axios.get(`${API_BASE}/api/port-remarks/${selectedPortId}`)
      .then(res => setRemarks(res.data))
      .catch(err => console.error(err));
  }, [selectedPortId]);

  const handleRemarkChange = (index, value) => {
    const updatedRemarks = [...remarks];
    updatedRemarks[index].remark_text = value;
    setRemarks(updatedRemarks);
  };

  const handleAddRemark = () => {
    setRemarks([...remarks, { remark_text: '', display_order: remarks.length }]);
  };

  const handleRemoveRemark = (index) => {
    setRemarks(remarks.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!selectedPortId) return;
    // Reatribui a ordem de exibição para garantir que seja sequencial
    const remarksToSave = remarks.map((remark, index) => ({
      ...remark,
      display_order: index,
    }));

    try {
  await axios.post(`${API_BASE}/api/port-remarks/${selectedPortId}`, { remarks: remarksToSave });
      alert('Observações salvas com sucesso!');
    } catch (err) {
      alert('Erro ao salvar observações.');
    }
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <div className="no-print" style={{ background: 'var(--background-default, #181c24)', minHeight: '100vh', padding: '32px 0' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', padding:'0 20px', boxSizing:'border-box' }}>
        <div className="app-card">
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: 'clamp(1.1rem,2vw+0.4rem,1.6rem)' }}>Gerenciar Observações Padrão por Porto</h2>
          <select className="themed-input" value={selectedPortId} onChange={(e) => setSelectedPortId(e.target.value)} style={{ marginTop:24 }}>
            <option value="">-- Selecione um Porto --</option>
            {ports.map(p => (
              <option key={p.id} value={p.id}>{`${p.name} - ${p.terminal} - ${p.berth}`}</option>
            ))}
          </select>

          {selectedPortId && (
            <div style={{ marginTop: '24px' }}>
              {remarks.map((remark, index) => (
                <div key={index} style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap:'wrap' }}>
                  <textarea
                    value={remark.remark_text}
                    onChange={(e) => handleRemarkChange(index, e.target.value)}
                    rows="3"
                    className="themed-input"
                    style={{ flex:'1 1 520px', minHeight: '60px', marginRight: 0, resize: 'vertical', fontSize: '1rem', borderRadius: '8px', padding: '8px', minWidth:260 }}
                  />
                  <button className="header-btn" style={{ minWidth: 0, fontWeight: 700, color: 'red', background: 'transparent' }} onClick={() => handleRemoveRemark(index)}>Remover</button>
                </div>
              ))}
              <button className="header-btn" style={{ minWidth: 0, fontWeight: 700, marginBottom: 12 }} onClick={handleAddRemark}>+ Adicionar Observação</button>
              <hr style={{ margin: '20px 0' }} />
              <button className="header-btn" style={{ minWidth: 0, fontWeight: 700 }} onClick={handleSave}>Salvar Todas as Observações para este Porto</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PortRemarksPage;