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
      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', padding: '0 20px', boxSizing:'border-box' }}>
        <div className="app-card">
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: 'clamp(1.1rem,2vw+0.4rem,1.5rem)' }}>Cadastrar Novo Serviço</h2>
          <form onSubmit={handleSubmit} className="app-form-grid" style={{ marginTop:24 }}>
            <input
              className="themed-input"
              type="text" name="name" placeholder="Nome do Serviço"
              value={newService.name} onChange={handleInputChange} required
            />
            <FormControlLabel
              control={<Checkbox name="is_taxable" checked={newService.is_taxable} onChange={handleInputChange} />}
              label="Sujeito a Imposto Municipal"
            />
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <button type="submit" className="header-btn" style={{ minWidth: 0, fontWeight: 700 }}>Cadastrar Serviço</button>
            </div>
          </form>
        </div>
        <div className="app-card">
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: 'clamp(1.1rem,2vw+0.4rem,1.5rem)' }}>Lista de Serviços Cadastrados</h2>
          <div className="table-responsive" style={{ marginTop:24 }}>
            <table className="table-basic">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome</th>
                  <th>Imposto Municipal?</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service.id}>
                    <td>{service.id}</td>
                    <td>{service.name}</td>
                    <td>{service.is_taxable ? 'Sim' : 'Não'}</td>
                    <td>
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