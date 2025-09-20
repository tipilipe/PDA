// frontend/src/pages/PortsPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';
import { Modal, Box, TextField, Button, Typography, Select, MenuItem, InputLabel, FormControl } from '@mui/material';

// Estilo para o Modal
const style = {
  position: 'absolute', top: '50%', left: '50%',
  transform: 'translate(-50%, -50%)', width: 400,
  bgcolor: 'background.paper', border: '2px solid #000',
  boxShadow: 24, p: 4,
};

function PortsPage() {
  const [ports, setPorts] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const initialFormState = { name: '', terminal: '', berth: '', client_id: '', remark: '' };
  const [newPort, setNewPort] = useState(initialFormState);

  // Estados para o Modal de Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPort, setEditingPort] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [portsResponse, clientsResponse] = await Promise.all([
  axios.get(`${API_BASE}/api/ports`),
  axios.get(`${API_BASE}/api/clients`)
      ]);
      setPorts(portsResponse.data);
      setClients(clientsResponse.data);
    } catch (err) {
      setError('Não foi possível buscar os dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleInputChange = (e) => {
    setNewPort({ ...newPort, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
  await axios.post(`${API_BASE}/api/ports`, newPort);
      setNewPort(initialFormState);
      fetchData();
    } catch (err) {
      alert('Erro ao cadastrar o porto.');
    }
  };

  // Funções do Modal
  const handleOpenEditModal = (port) => {
    setEditingPort(port);
    setIsModalOpen(true);
  };
  const handleCloseEditModal = () => {
    setIsModalOpen(false);
    setEditingPort(null);
  };
  const handleEditInputChange = (e) => {
    setEditingPort({ ...editingPort, [e.target.name]: e.target.value });
  };
  const handleUpdatePort = async () => {
    if (!editingPort) return;
    try {
  await axios.put(`${API_BASE}/api/ports/${editingPort.id}`, editingPort);
      handleCloseEditModal();
      fetchData();
    } catch (err) {
      alert('Erro ao atualizar o porto.');
    }
  };

  if (loading) return <div>Carregando...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div style={{ background: 'var(--background-default, #181c24)', minHeight: '100vh', padding: '32px 0' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div className="card-action-area" style={{ background: '#fff', borderRadius: '18px', boxShadow: '0 2px 16px 0 rgba(0,0,0,0.10)', padding: '32px 32px 24px 32px', border: 'none', marginBottom: 0 }}>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.5rem', color: '#222' }}>Cadastrar Novo Porto</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', margin: '24px 0 0 0' }}>
            <input className="themed-input" type="text" name="name" placeholder="Nome do Porto *" value={newPort.name} onChange={handleInputChange} required />
            <input className="themed-input" type="text" name="terminal" placeholder="Terminal *" value={newPort.terminal} onChange={handleInputChange} required />
            <input className="themed-input" type="text" name="berth" placeholder="Berço *" value={newPort.berth} onChange={handleInputChange} required />
            <select className="themed-input" name="client_id" value={newPort.client_id || ''} onChange={handleInputChange}>
              <option value="">-- Nenhum Cliente --</option>
              {clients.map(client => (<option key={client.id} value={client.id}>{client.name}</option>))}
            </select>
            <input className="themed-input" type="text" name="remark" placeholder="Observação" value={newPort.remark} onChange={handleInputChange} />
            <button type="submit" className="header-btn" style={{ minWidth: 0, fontWeight: 700 }}>Cadastrar Porto</button>
          </form>
        </div>
        <div className="card-action-area" style={{ background: '#fff', borderRadius: '18px', boxShadow: '0 2px 16px 0 rgba(0,0,0,0.10)', padding: '32px 32px 24px 32px', border: 'none', marginBottom: 0 }}>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.5rem', color: '#222' }}>Lista de Portos Cadastrados</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, background: '#f8fafd', borderRadius: '10px', boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)' }}>
              <thead>
                <tr style={{ background: '#e3eafc' }}>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>ID</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>Porto</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>Terminal</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>Berço</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>Cliente Associado</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>Observação</th>
                  <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {ports.map((port) => (
                  <tr key={port.id}>
                    <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{port.id}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{port.name}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{port.terminal}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{port.berth}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{port.client_name || 'N/A'}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{port.remark}</td>
                    <td style={{ padding: '10px 8px' }}><button className="header-btn" style={{ minWidth: 0, fontWeight: 700 }} onClick={() => handleOpenEditModal(port)}>Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Modal open={isModalOpen} onClose={handleCloseEditModal}>
          <Box sx={style}>
            <Typography variant="h6" component="h2" sx={{width: '100%', mb: 2}}>Editando Porto</Typography>
            <TextField name="name" label="Nome do Porto" value={editingPort?.name || ''} onChange={handleEditInputChange} fullWidth />
            <TextField name="terminal" label="Terminal" value={editingPort?.terminal || ''} onChange={handleEditInputChange} fullWidth />
            <TextField name="berth" label="Berço" value={editingPort?.berth || ''} onChange={handleEditInputChange} fullWidth />
            <FormControl fullWidth>
              <InputLabel>Cliente Associado</InputLabel>
              <Select name="client_id" value={editingPort?.client_id || ''} label="Cliente Associado" onChange={handleEditInputChange}>
                <MenuItem value=""><em>Nenhum</em></MenuItem>
                {clients.map(client => (<MenuItem key={client.id} value={client.id}>{client.name}</MenuItem>))}
              </Select>
            </FormControl>
            <TextField name="remark" label="Observação" value={editingPort?.remark || ''} onChange={handleEditInputChange} fullWidth />
            <Box sx={{width: '100%', textAlign: 'right', mt: 2}}>
              <Button onClick={handleCloseEditModal} sx={{mr: 1}}>Cancelar</Button>
              <Button onClick={handleUpdatePort} variant="contained">Salvar Alterações</Button>
            </Box>
          </Box>
        </Modal>
      </div>
    </div>
  );
}

export default PortsPage;