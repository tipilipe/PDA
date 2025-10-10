// frontend/src/pages/ClientsPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';
import { Modal, Box, TextField, Button, Typography } from '@mui/material';

// Estilo para o Modal
const style = {
  position: 'absolute', top: '50%', left: '50%',
  transform: 'translate(-50%, -50%)', width: 400,
  bgcolor: 'background.paper', border: '2px solid #000',
  boxShadow: 24, p: 4,
};

function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  
  const initialFormState = { name: '', po_number: '', vat_number: '', address: '', remark: '' };
  const [newClient, setNewClient] = useState(initialFormState);

  // Estados para o Modal de Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  const fetchClients = async () => {
    try {
      setLoading(true);
  const response = await axios.get(`${API_BASE}/api/clients`);
      setClients(response.data);
    } catch (err) {
      setError('Não foi possível buscar os dados dos clientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const handleInputChange = (e) => {
    setNewClient({ ...newClient, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
  await axios.post(`${API_BASE}/api/clients`, newClient);
      setNewClient(initialFormState);
      fetchClients();
    } catch (err) {
      alert('Erro ao cadastrar o cliente.');
    }
  };
  
  // Funções do Modal
  const handleOpenEditModal = (client) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };
  const handleCloseEditModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
  };
  const handleEditInputChange = (e) => {
    setEditingClient({ ...editingClient, [e.target.name]: e.target.value });
  };
  const handleUpdateClient = async () => {
    if (!editingClient) return;
    try {
  await axios.put(`${API_BASE}/api/clients/${editingClient.id}`, editingClient);
      handleCloseEditModal();
      fetchClients();
    } catch (err) {
      alert('Erro ao atualizar o cliente.');
    }
  };

  const handleDeleteClient = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este cliente?')) return;
    try {
      await axios.delete(`${API_BASE}/api/clients/${id}`);
      fetchClients();
    } catch (err) {
      alert('Erro ao excluir o cliente.');
      console.error(err);
    }
  };

  return (
    <div className="no-print" style={{ background: 'var(--background-default, #181c24)', minHeight: '100vh', padding: '32px 0' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', padding: '0 20px', boxSizing:'border-box' }}>
        <div className="app-card">
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: 'clamp(1.1rem,2vw+0.4rem,1.5rem)' }}>Cadastrar Novo Cliente</h2>
          <form onSubmit={handleSubmit} className="app-form-grid" style={{ marginTop:24 }}>
            <input type="text" name="name" placeholder="Nome *" value={newClient.name} onChange={handleInputChange} required />
            <input type="text" name="po_number" placeholder="PO Number" value={newClient.po_number} onChange={handleInputChange} />
            <input type="text" name="vat_number" placeholder="VAT Number" value={newClient.vat_number} onChange={handleInputChange} />
            <input type="text" name="address" placeholder="Endereço" value={newClient.address} onChange={handleInputChange} />
            <input type="text" name="remark" placeholder="Observação" value={newClient.remark} onChange={handleInputChange} />
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <button type="submit" className="header-btn">Cadastrar Cliente</button>
            </div>
          </form>
          <hr style={{ margin:'28px 0 20px' }} />
          <h2 style={{ marginTop:0, fontSize: 'clamp(1rem,2vw+0.3rem,1.35rem)' }}>Lista de Clientes Cadastrados</h2>
          <div style={{ marginTop:12 }}>
            <input
              className="themed-input"
              placeholder="Pesquisar por nome, PO, VAT, endereço..."
              value={search}
              onChange={(e)=>setSearch(e.target.value)}
              style={{ width:'100%', maxWidth:420 }}
            />
          </div>
          {loading && <div>Carregando...</div>}
          {error && <div style={{ color: 'red' }}>{error}</div>}
          {!loading && !error && (
            <div className="table-responsive" style={{ maxHeight: 420, overflow: 'auto', marginTop:12 }}>
              <table className="table-basic">
              <thead>
                <tr>
                  <th>ID</th><th>Nome</th><th>PO Number</th><th>VAT Number</th>
                  <th>Endereço</th><th>Observação</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {clients
                  .filter((c)=>{
                    const q = search.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      String(c.name||'').toLowerCase().includes(q) ||
                      String(c.po_number||'').toLowerCase().includes(q) ||
                      String(c.vat_number||'').toLowerCase().includes(q) ||
                      String(c.address||'').toLowerCase().includes(q) ||
                      String(c.remark||'').toLowerCase().includes(q) ||
                      String(c.id||'').toLowerCase().includes(q)
                    );
                  })
                  .map((client) => (
                  <tr key={client.id}>
                    <td>{client.id}</td><td>{client.name}</td><td>{client.po_number}</td>
                    <td>{client.vat_number}</td><td>{client.address}</td><td>{client.remark}</td>
                      <td>
                        <button className="header-btn" style={{ minWidth: 0, fontWeight: 700 }} onClick={() => handleOpenEditModal(client)}>
                          <span role="img" aria-label="Editar">✏️</span>
                        </button>
                        <button className="header-btn" style={{ minWidth: 0, fontWeight: 700, background: '#b42318', marginLeft: 6 }} onClick={() => handleDeleteClient(client.id)}>
                          <span role="img" aria-label="Excluir">🗑️</span>
                        </button>
                      </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          )}

          <Modal open={isModalOpen} onClose={handleCloseEditModal}>
            <Box sx={style}>
              <Typography variant="h6" component="h2" sx={{width: '100%', mb: 2}}>
                Editando Cliente: {editingClient?.name}
              </Typography>
              <TextField name="name" label="Nome" value={editingClient?.name || ''} onChange={handleEditInputChange} fullWidth />
              <TextField name="po_number" label="PO Number" value={editingClient?.po_number || ''} onChange={handleEditInputChange} fullWidth />
              <TextField name="vat_number" label="VAT Number" value={editingClient?.vat_number || ''} onChange={handleEditInputChange} fullWidth />
              <TextField name="address" label="Endereço" value={editingClient?.address || ''} onChange={handleEditInputChange} fullWidth />
              <TextField name="remark" label="Observação" value={editingClient?.remark || ''} onChange={handleEditInputChange} fullWidth />
              <Box sx={{width: '100%', textAlign: 'right', mt: 2}}>
                <Button onClick={handleCloseEditModal} sx={{mr: 1}}>Cancelar</Button>
                <Button onClick={handleUpdateClient} variant="contained">Salvar Alterações</Button>
              </Box>
            </Box>
          </Modal>
        </div>
      </div>
    </div>
  );
}

export default ClientsPage;