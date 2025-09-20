// frontend/src/pages/ServicePage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';
import { Modal, Box, TextField, Button, Typography, Checkbox, FormControlLabel } from '@mui/material';

const style = {
  position: 'absolute', top: '50%', left: '50%',
  transform: 'translate(-50%, -50%)', width: 400,
  bgcolor: 'background.paper', border: '2px solid #000',
  boxShadow: 24, p: 4,
};

function ServicePage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const initialFormState = { name: '', is_taxable: false };
  const [newService, setNewService] = useState(initialFormState);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);

  const fetchServices = async () => {
    try {
      setLoading(true);
  const response = await axios.get(`${API_BASE}/api/services`);
      setServices(response.data);
    } catch (err) {
      setError('Não foi possível buscar os dados dos serviços.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchServices(); }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewService(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
  await axios.post(`${API_BASE}/api/services`, newService);
      setNewService(initialFormState);
      fetchServices();
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Erro ao cadastrar o serviço.';
      alert(`Atenção: ${errorMsg}`);
    }
  };

  const handleOpenEditModal = (service) => {
    setEditingService(service);
    setIsModalOpen(true);
  };
  const handleCloseEditModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
  };
  const handleEditInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditingService(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  const handleUpdateService = async () => {
    if (!editingService) return;
    try {
  await axios.put(`${API_BASE}/api/services/${editingService.id}`, editingService);
      handleCloseEditModal();
      fetchServices();
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Erro ao atualizar o serviço.';
      alert(`Atenção: ${errorMsg}`);
    }
  };

  if (loading) return <div>Carregando...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div style={{ background: 'var(--background-default, #181c24)', minHeight: '100vh', padding: '32px 0' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div className="card-action-area" style={{ background: '#fff', borderRadius: '18px', boxShadow: '0 2px 16px 0 rgba(0,0,0,0.10)', padding: '32px 32px 24px 32px', border: 'none', marginBottom: 0 }}>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.5rem', color: '#222' }}>Cadastrar Novo Serviço</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', margin: '24px 0 0 0' }}>
            <input
              className="themed-input"
              type="text" name="name" placeholder="Nome do Serviço"
              value={newService.name} onChange={handleInputChange} required
            />
            <FormControlLabel
              control={<Checkbox name="is_taxable" checked={newService.is_taxable} onChange={handleInputChange} />}
              label="Sujeito a Imposto Municipal"
            />
            <button type="submit" className="header-btn" style={{ minWidth: 0, fontWeight: 700 }}>Cadastrar Serviço</button>
          </form>
        </div>
        <div className="card-action-area" style={{ background: '#fff', borderRadius: '18px', boxShadow: '0 2px 16px 0 rgba(0,0,0,0.10)', padding: '32px 32px 24px 32px', border: 'none', marginBottom: 0 }}>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.5rem', color: '#222' }}>Lista de Serviços Cadastrados</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, background: '#f8fafd', borderRadius: '10px', boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)' }}>
              <thead>
                <tr style={{ background: '#e3eafc' }}>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>ID</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>Nome</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>Imposto Municipal?</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service.id}>
                    <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{service.id}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{service.name}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{service.is_taxable ? 'Sim' : 'Não'}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <button className="header-btn" style={{ minWidth: 0, fontWeight: 700 }} onClick={() => handleOpenEditModal(service)}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Modal open={isModalOpen} onClose={handleCloseEditModal}>
          <Box sx={style}>
            <Typography variant="h6" component="h2" sx={{width: '100%', mb: 2}}>
              Editando Serviço: {editingService?.name}
            </Typography>
            <TextField
              name="name" label="Nome do Serviço"
              value={editingService?.name || ''} onChange={handleEditInputChange} fullWidth
            />
            <FormControlLabel
              control={<Checkbox name="is_taxable" checked={editingService?.is_taxable || false} onChange={handleEditInputChange} />}
              label="Sujeito a Imposto Municipal"
            />
            <Box sx={{width: '100%', textAlign: 'right', mt: 2}}>
              <Button onClick={handleCloseEditModal} sx={{mr: 1}}>Cancelar</Button>
              <Button onClick={handleUpdateService} variant="contained">Salvar Alterações</Button>
            </Box>
          </Box>
        </Modal>
      </div>
    </div>
  );
}

export default ServicePage;