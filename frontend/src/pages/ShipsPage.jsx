// frontend/src/pages/ShipsPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';
// --- Typography adicionado na linha de import abaixo ---
import { Modal, Box, TextField, Button, Typography } from '@mui/material';

// Estilo para o Modal (pop-up)
const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 600,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
  display: 'flex',
  flexWrap: 'wrap',
  gap: '15px'
};

function ShipsPage() {
  const [ships, setShips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const initialFormState = { name: '', imo: '', dwt: '', grt: '', net: '', loa: '', beam: '', draft: '', depth: '', flag: '', year: '' };
  const [newShip, setNewShip] = useState(initialFormState);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShip, setEditingShip] = useState(null);

  const fetchShips = async () => {
    try {
      setLoading(true);
  const response = await axios.get(`${API_BASE}/api/ships`);
      setShips(response.data);
    } catch (err) {
      setError('Não foi possível buscar os dados dos navios.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShips();
  }, []);

  const handleInputChange = (e) => {
    setNewShip({ ...newShip, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
  await axios.post(`${API_BASE}/api/ships`, newShip);
      setNewShip(initialFormState);
      fetchShips();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        alert(`Atenção: ${err.response.data.error}`);
      } else {
        alert('Erro ao cadastrar o navio.');
      }
      console.error(err);
    }
  };

  const handleOpenEditModal = (ship) => {
    setEditingShip(ship);
    setIsModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsModalOpen(false);
    setEditingShip(null);
  };

  const handleEditInputChange = (e) => {
    setEditingShip({ ...editingShip, [e.target.name]: e.target.value });
  };
  
  const handleUpdateShip = async () => {
    if (!editingShip) return;
    try {
  await axios.put(`${API_BASE}/api/ships/${editingShip.id}`, editingShip);
      handleCloseEditModal();
      fetchShips();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        alert(`Atenção: ${err.response.data.error}`);
      } else {
        alert('Erro ao atualizar o navio.');
      }
      console.error(err);
    }
  };

  return (
    <div style={{ background: 'var(--background-default, #181c24)', minHeight: '100vh', padding: '32px 0' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div className="card-action-area" style={{ background: '#fff', borderRadius: '18px', boxShadow: '0 2px 16px 0 rgba(0,0,0,0.10)', padding: '32px 32px 24px 32px', border: 'none', marginBottom: 0 }}>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.5rem', color: '#222' }}>Cadastrar Novo Navio</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', margin: '24px 0 0 0' }}>
            <input className="themed-input" type="text" name="name" placeholder="Nome *" value={newShip.name} onChange={handleInputChange} required />
            <input className="themed-input" type="text" name="imo" placeholder="IMO" value={newShip.imo} onChange={handleInputChange} />
            <input className="themed-input" type="text" name="flag" placeholder="Bandeira" value={newShip.flag} onChange={handleInputChange} />
            <input className="themed-input" type="number" name="year" placeholder="Ano" value={newShip.year} onChange={handleInputChange} />
            <input className="themed-input" type="number" name="dwt" placeholder="DWT" value={newShip.dwt} onChange={handleInputChange} />
            <input className="themed-input" type="number" name="grt" placeholder="GRT" value={newShip.grt} onChange={handleInputChange} />
            <input className="themed-input" type="number" name="net" placeholder="NET" value={newShip.net} onChange={handleInputChange} />
            <input className="themed-input" type="number" name="loa" placeholder="LOA (Comprimento)" value={newShip.loa} onChange={handleInputChange} />
            <input className="themed-input" type="number" name="beam" placeholder="BEAM (Boca)" value={newShip.beam} onChange={handleInputChange} />
            <input className="themed-input" type="number" name="draft" placeholder="DRAFT (Calado)" value={newShip.draft} onChange={handleInputChange} />
            <input className="themed-input" type="number" name="depth" placeholder="DEPTH (Pontal)" value={newShip.depth} onChange={handleInputChange} />
            <button type="submit" className="header-btn" style={{ minWidth: 0, fontWeight: 700 }}>Cadastrar Navio</button>
          </form>
        </div>
        <div className="card-action-area" style={{ background: '#fff', borderRadius: '18px', boxShadow: '0 2px 16px 0 rgba(0,0,0,0.10)', padding: '32px 32px 24px 32px', border: 'none', marginBottom: 0 }}>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.5rem', color: '#222' }}>Lista de Navios Cadastrados</h2>
          {loading && <div>Carregando navios...</div>}
          {error && <div style={{ color: 'red' }}>{error}</div>}
          {!loading && !error && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, background: '#f8fafd', borderRadius: '10px', boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)' }}>
                <thead>
                  <tr style={{ background: '#e3eafc' }}>
                    <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>ID</th>
                    <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>Nome</th>
                    <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>IMO</th>
                    <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>Bandeira</th>
                    <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>Ano</th>
                    <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>DWT</th>
                    <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>GRT</th>
                    <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>NET</th>
                    <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>LOA</th>
                    <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>BEAM</th>
                    <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>DRAFT</th>
                    <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>DEPTH</th>
                    <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {ships.map((ship) => (
                    <tr key={ship.id}>
                      <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{ship.id}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{ship.name}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{ship.imo}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{ship.flag}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{ship.year}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{ship.dwt}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{ship.grt}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{ship.net}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{ship.loa}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{ship.beam}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{ship.draft}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{ship.depth}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <button className="header-btn" style={{ minWidth: 0, fontWeight: 700 }} onClick={() => handleOpenEditModal(ship)}>Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <Modal open={isModalOpen} onClose={handleCloseEditModal}>
          <Box sx={style}>
            <Typography variant="h6" component="h2" sx={{width: '100%'}}>
              Editando Navio: {editingShip?.name}
            </Typography>
            <TextField name="name" label="Nome" value={editingShip?.name || ''} onChange={handleEditInputChange} variant="outlined" size="small"/>
            <TextField name="imo" label="IMO" value={editingShip?.imo || ''} onChange={handleEditInputChange} variant="outlined" size="small"/>
            <TextField name="flag" label="Bandeira" value={editingShip?.flag || ''} onChange={handleEditInputChange} variant="outlined" size="small"/>
            <TextField name="year" label="Ano" type="number" value={editingShip?.year || ''} onChange={handleEditInputChange} variant="outlined" size="small"/>
            <TextField name="dwt" label="DWT" type="number" value={editingShip?.dwt || ''} onChange={handleEditInputChange} variant="outlined" size="small"/>
            <TextField name="grt" label="GRT" type="number" value={editingShip?.grt || ''} onChange={handleEditInputChange} variant="outlined" size="small"/>
            <TextField name="net" label="NET" type="number" value={editingShip?.net || ''} onChange={handleEditInputChange} variant="outlined" size="small"/>
            <TextField name="loa" label="LOA" type="number" value={editingShip?.loa || ''} onChange={handleEditInputChange} variant="outlined" size="small"/>
            <TextField name="beam" label="BEAM" type="number" value={editingShip?.beam || ''} onChange={handleEditInputChange} variant="outlined" size="small"/>
            <TextField name="draft" label="DRAFT" type="number" value={editingShip?.draft || ''} onChange={handleEditInputChange} variant="outlined" size="small"/>
            <TextField name="depth" label="DEPTH" type="number" value={editingShip?.depth || ''} onChange={handleEditInputChange} variant="outlined" size="small"/>
            <Box sx={{width: '100%', textAlign: 'right', mt: 2}}>
              <Button onClick={handleCloseEditModal} sx={{mr: 1}}>Cancelar</Button>
              <Button onClick={handleUpdateShip} variant="contained">Salvar Alterações</Button>
            </Box>
          </Box>
        </Modal>
      </div>
    </div>
  );
}

export default ShipsPage;