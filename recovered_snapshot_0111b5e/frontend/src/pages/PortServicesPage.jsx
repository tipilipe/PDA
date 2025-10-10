// frontend/src/pages/PortServicesPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';

function PortServicesPage() {
  // Estados para os dados
  const [ports, setPorts] = useState([]);
  const [allServices, setAllServices] = useState([]);
  const [selectedPortId, setSelectedPortId] = useState('');

  // Estados para as listas
  const [linkedServices, setLinkedServices] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);

  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Busca inicial de todos os portos e todos os serviços
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [portsRes, servicesRes] = await Promise.all([
          axios.get(`${API_BASE}/api/ports`),
          axios.get(`${API_BASE}/api/services`),
        ]);
        setPorts(portsRes.data);
        setAllServices(servicesRes.data);
      } catch (err) {
        setError('Falha ao carregar dados iniciais.');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // Efeito que roda quando o usuário seleciona um porto
  useEffect(() => {
    if (!selectedPortId) {
      setLinkedServices([]);
      setAvailableServices(allServices);
      return;
    }

    const fetchLinkedServices = async () => {
      try {
  const res = await axios.get(`${API_BASE}/api/port-services/${selectedPortId}`);
        const linkedIds = new Set(res.data);

        const linked = allServices.filter(s => linkedIds.has(s.id));
        const available = allServices.filter(s => !linkedIds.has(s.id));

        setLinkedServices(linked);
        setAvailableServices(available);
      } catch (err) {
        setError('Falha ao buscar serviços vinculados.');
      }
    };

    fetchLinkedServices();
  }, [selectedPortId, allServices]);

  const handleLink = (service) => {
    setAvailableServices(availableServices.filter(s => s.id !== service.id));
    setLinkedServices([...linkedServices, service]);
  };

  const handleUnlink = (service) => {
    setLinkedServices(linkedServices.filter(s => s.id !== service.id));
    setAvailableServices([...availableServices, service]);
  };

  const handleSave = async () => {
    if (!selectedPortId) return;
    try {
      const serviceIds = linkedServices.map(s => s.id);
  await axios.post(`${API_BASE}/api/port-services/${selectedPortId}`, { serviceIds });
      alert('Vínculos salvos com sucesso!');
    } catch (err) {
      alert('Erro ao salvar os vínculos.');
    }
  };

  if (loading) return <div>Carregando...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div className="no-print" style={{ background: 'var(--background-default, #181c24)', minHeight: '100vh', padding: '32px 0' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', padding: '0 20px', boxSizing:'border-box' }}>
        <div className="app-card">
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: 'clamp(1.1rem,2vw+0.4rem,1.5rem)' }}>Vincular Serviços a um Porto</h2>
          <div style={{ marginBottom: '24px', marginTop: '16px' }}>
            <select className="themed-input" value={selectedPortId} onChange={(e) => setSelectedPortId(e.target.value)}>
              <option value="">-- Selecione um Porto --</option>
              {ports.map(p => (
                <option key={p.id} value={p.id}>{`${p.name} - ${p.terminal} - ${p.berth}`}</option>
              ))}
            </select>
          </div>

          {selectedPortId && (
            <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
              <div style={{ background: '#f8fafd', borderRadius: '12px', boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)', padding: '18px', flex: '1 1 320px', minWidth: 260 }}>
                <h3 style={{ color: '#222', fontWeight: 700, marginBottom: 12 }}>Serviços Disponíveis</h3>
                {availableServices.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                    <span>{s.name}</span>
                    <button className="header-btn" style={{ minWidth: 0, fontWeight: 700 }} onClick={() => handleLink(s)}>&gt;</button>
                  </div>
                ))}
              </div>
              <div style={{ background: '#f8fafd', borderRadius: '12px', boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)', padding: '18px', flex: '1 1 320px', minWidth: 260 }}>
                <h3 style={{ color: '#222', fontWeight: 700, marginBottom: 12 }}>Serviços Vinculados</h3>
                {linkedServices.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                    <button className="header-btn" style={{ minWidth: 0, fontWeight: 700 }} onClick={() => handleUnlink(s)}>&lt;</button>
                    <span>{s.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {selectedPortId && (
            <button className="header-btn" style={{ marginTop: '24px', minWidth: 0, fontWeight: 700 }} onClick={handleSave}>Salvar Vínculos</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PortServicesPage;