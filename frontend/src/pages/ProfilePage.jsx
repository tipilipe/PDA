// frontend/src/pages/ProfilePage.jsx
import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';
import AuthContext from '../context/AuthContext';
import { Box, TextField, Button, Typography, Paper, Grid } from '@mui/material';

function ProfilePage() {
  const [profile, setProfile] = useState({
    company: { name: '', subtitle: '', cnpj: '', address: '', logo_url: '', bank_details_1: {}, bank_details_2: {}, bank_details_3: {} },
    user: { name: '', email: '' }
  });
  const [loading, setLoading] = useState(true);
  const { authTokens } = useContext(AuthContext);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
  const response = await axios.get(`${API_BASE}/api/company/profile`);
        const data = response.data;
        const parseBankText = (txt) => {
          if (!txt || typeof txt !== 'string') return {};
          const obj = {};
          String(txt).split('\n').forEach(line => {
            const [k, ...rest] = line.split(':');
            const val = rest.join(':').trim();
            if (/BANK/i.test(k)) obj.bank_name = val;
            if (/AGENC/i.test(k)) obj.agency = val;
            if (/ACCOUNT|CONTA/i.test(k)) obj.account = val;
            if (/IBAN/i.test(k)) obj.iban = val;
            if (/SWIFT/i.test(k)) obj.swift = val;
          });
          return obj;
        };
        data.company.bank_details_1 = parseBankText(data.company.bank_details_1);
        data.company.bank_details_2 = parseBankText(data.company.bank_details_2);
        data.company.bank_details_3 = parseBankText(data.company.bank_details_3);
        setProfile(data);
      } catch (error) {
        console.error("Erro ao buscar perfil", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [authTokens]);

  const handleChange = (e, section, bankIndex = null, bankField = null) => {
    if (bankIndex !== null) {
      const newProfile = { ...profile };
      newProfile.company[`bank_details_${bankIndex}`][bankField] = e.target.value;
      setProfile(newProfile);
    } else {
      setProfile({
        ...profile,
        [section]: {
          ...profile[section],
          [e.target.name]: e.target.value
        }
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const toText = (obj) => {
        if (!obj) return '';
        const lines = [];
        if (obj.bank_name) lines.push(`BANK: ${obj.bank_name}`);
        if (obj.agency) lines.push(`AGENCY: ${obj.agency}`);
        if (obj.account) lines.push(`ACCOUNT: ${obj.account}`);
        if (obj.iban) lines.push(`IBAN: ${obj.iban}`);
        if (obj.swift) lines.push(`SWIFT: ${obj.swift}`);
        return lines.join('\n');
      };
      const payload = {
        ...profile,
        company: {
          ...profile.company,
          bank_details_1: toText(profile.company.bank_details_1),
          bank_details_2: toText(profile.company.bank_details_2),
          bank_details_3: toText(profile.company.bank_details_3),
        }
      };
  const response = await axios.put(`${API_BASE}/api/company/profile`, payload);
      alert(response.data.message);
    } catch (error) {
      alert('Erro ao atualizar perfil.');
      console.error(error);
    }
  };

  if (loading) return <div>Carregando perfil...</div>;

  return (
    <div style={{ background: 'var(--background-default, #181c24)', minHeight: '100vh', padding: '32px 0' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', padding:'0 20px', boxSizing:'border-box' }}>
        <div className="app-card">
          <form onSubmit={handleSubmit}>
            <Typography variant="h4" gutterBottom style={{ color: '#222', fontWeight: 700, fontSize:'clamp(1.3rem,2.2vw+0.5rem,2rem)' }}>Perfil da Empresa e Usuário</Typography>
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>Dados da Empresa</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField label="Nome da Empresa" name="name" value={profile.company.name || ''} onChange={(e) => handleChange(e, 'company')} fullWidth disabled={!!profile.company.name} helperText={profile.company.name ? "Para alterar o nome, contate o administrador." : "Este campo só pode ser preenchido uma vez."}/>
                </Grid>
                <Grid item xs={12} sm={6}><TextField label="Complemento (Ex: Serviços de Agenciamento...)" name="subtitle" value={profile.company.subtitle || ''} onChange={(e) => handleChange(e, 'company')} fullWidth /></Grid>
                <Grid item xs={12} sm={6}><TextField label="CNPJ" name="cnpj" value={profile.company.cnpj || ''} onChange={(e) => handleChange(e, 'company')} fullWidth /></Grid>
                <Grid item xs={12} sm={6}><TextField label="URL do Logo" name="logo_url" value={profile.company.logo_url || ''} onChange={(e) => handleChange(e, 'company')} fullWidth /></Grid>
                <Grid item xs={12}><TextField label="Endereço" name="address" value={profile.company.address || ''} onChange={(e) => handleChange(e, 'company')} fullWidth multiline rows={3} /></Grid>
              </Grid>
            </Paper>
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>Dados do Usuário</Typography>
              <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}><TextField label="Nome do Usuário" name="name" value={profile.user.name || ''} onChange={(e) => handleChange(e, 'user')} fullWidth /></Grid>
                  <Grid item xs={12} sm={6}><TextField label="Email (Login)" name="email" value={profile.user.email || ''} fullWidth disabled /></Grid>
              </Grid>
            </Paper>
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>Dados Bancários</Typography>
              <Grid container spacing={2}>
                {[1, 2, 3].map(i => (
                  <Grid item xs={12} md={4} key={i}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography>Banco {i}</Typography>
                      <TextField label="Nome do Banco" value={profile.company[`bank_details_${i}`]?.bank_name || ''} onChange={(e) => handleChange(e, 'company', i, 'bank_name')} fullWidth margin="normal" size="small" />
                      <TextField label="Agência" value={profile.company[`bank_details_${i}`]?.agency || ''} onChange={(e) => handleChange(e, 'company', i, 'agency')} fullWidth margin="normal" size="small" />
                      <TextField label="Conta" value={profile.company[`bank_details_${i}`]?.account || ''} onChange={(e) => handleChange(e, 'company', i, 'account')} fullWidth margin="normal" size="small" />
                      <TextField label="IBAN" value={profile.company[`bank_details_${i}`]?.iban || ''} onChange={(e) => handleChange(e, 'company', i, 'iban')} fullWidth margin="normal" size="small" />
                      <TextField label="SWIFT" value={profile.company[`bank_details_${i}`]?.swift || ''} onChange={(e) => handleChange(e, 'company', i, 'swift')} fullWidth margin="normal" size="small" />
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Paper>
            <button type="submit" className="header-btn" style={{ fontWeight: 700 }}>Salvar Alterações do Perfil</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;