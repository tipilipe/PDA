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
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', padding: '0 20px', boxSizing:'border-box' }}>
        <div className="app-card">
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: 'clamp(1.1rem,2vw+0.4rem,1.5rem)' }}>Cadastrar Novo Navio</h2>
          <form onSubmit={handleSubmit} className="app-form-grid" style={{ marginTop:24 }}>
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
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <button type="submit" className="header-btn" style={{ minWidth: 0, fontWeight: 700 }}>Cadastrar Navio</button>
            </div>
          </form>
        </div>
        <div className="app-card">
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: 'clamp(1.1rem,2vw+0.4rem,1.5rem)' }}>Lista de Navios Cadastrados</h2>
          {loading && <div>Carregando navios...</div>}
          {error && <div style={{ color: 'red' }}>{error}</div>}
          {!loading && !error && (
            <div className="table-responsive">
              <table className="table-basic">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nome</th>
                    <th>IMO</th>
                    <th>Bandeira</th>
                    <th>Ano</th>
                    <th>DWT</th>
                    <th>GRT</th>
                    <th>NET</th>
                    <th>LOA</th>
                    <th>BEAM</th>
                    <th>DRAFT</th>
                    <th>DEPTH</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {ships.map((ship) => (
                    <tr key={ship.id}>
                      <td>{ship.id}</td>
                      <td>{ship.name}</td>
                      <td>{ship.imo}</td>
                      <td>{ship.flag}</td>
                      <td>{ship.year}</td>
                      <td>{ship.dwt}</td>
                      <td>{ship.grt}</td>
                      <td>{ship.net}</td>
                      <td>{ship.loa}</td>
                      <td>{ship.beam}</td>
                      <td>{ship.draft}</td>
                      <td>{ship.depth}</td>
                      <td>
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