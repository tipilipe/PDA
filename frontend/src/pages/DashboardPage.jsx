import PersonIcon from '@mui/icons-material/Person';
import React, { useContext, useState, useEffect } from 'react';
import { Box } from '@mui/material';
import axios from 'axios';
import { ColorModeContext } from '../App';

const DashboardPage = () => {
  console.log('[DEBUG] DashboardPage.jsx montado');

  // Tema global via contexto
  const colorMode = useContext(ColorModeContext);
  const mode = colorMode && colorMode.mode ? colorMode.mode : 'dark';


  // Estados para dados reais
  const [dataPdasCliente, setDataPdasCliente] = useState([]);
  const [dataPdasPorto, setDataPdasPorto] = useState([]);
  const [dataCustosPorto, setDataCustosPorto] = useState([]);
  const [dataComparativo, setDataComparativo] = useState([]);
  const pieColors = ['#6ec1e4', '#1976d2', '#00bcd4', '#1976d2', '#b388ff'];

  useEffect(() => {
    // Função para buscar dados do backend
    const fetchData = async () => {
      try {
        // PDAs por Cliente
        const resCliente = await axios.get('/api/admin/dashboard/pdas-por-cliente');
        setDataPdasCliente(resCliente.data.map(item => ({ name: item.cliente, pdas: Number(item.total) })));

        // PDAs por Porto
        const resPorto = await axios.get('/api/admin/dashboard/pdas-por-porto');
        setDataPdasPorto(resPorto.data.map(item => ({ name: item.porto, pdas: Number(item.total) })));

        // Custos por Porto
        const resCustos = await axios.get('/api/admin/dashboard/custos-por-porto');
        setDataCustosPorto(resCustos.data.map(item => ({ name: item.porto, custo: Number(item.custo) })));

        // Comparativo Navios x Portos
        const resComp = await axios.get('/api/admin/dashboard/comparativo-navios-portos');
        // Transformar para formato de gráfico de linhas: [{ name: 'Navio', Porto1: 2, Porto2: 3, ... }]
        const compRaw = resComp.data;
        const navios = [...new Set(compRaw.map(i => i.navio))];
        const portos = [...new Set(compRaw.map(i => i.porto))];
        const compData = navios.map(navio => {
          const obj = { name: navio };
          portos.forEach(porto => {
            const found = compRaw.find(i => i.navio === navio && i.porto === porto);
            obj[porto] = found ? Number(found.total) : 0;
          });
          return obj;
        });
        setDataComparativo(compData);
      } catch (err) {
        // eslint-disable-next-line
        console.error('Erro ao buscar métricas do dashboard:', err);
      }
    };
    fetchData();
  }, []);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
          {/* Sidebar com atalhos das abas principais */}
          <Box sx={{ width: 240, bgcolor: 'background.paper', color: 'text.primary', p: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: 3 }}>
            <Box sx={{ width: '100%', bgcolor: 'background.paper', p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: mode === 'dark' ? '#2e3a59' : '#e3eaf6', mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PersonIcon sx={{ fontSize: 40, color: 'primary.main' }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Usuário</Typography>
            </Box>
            <Divider sx={{ bgcolor: mode === 'dark' ? '#34405c' : '#e3eaf6', width: '80%', mb: 2 }} />
            <List sx={{ width: '100%' }}>
              <ListItem button component={Link} to="/dashboard">
                <ListItemIcon sx={{ color: 'primary.main' }}><HomeIcon /></ListItemIcon>
                <ListItemText primary="Dashboard" />
              </ListItem>
              <ListItem button component={Link} to="/pda">
                <ListItemIcon sx={{ color: 'primary.main' }}><HomeIcon /></ListItemIcon>
                <ListItemText primary="Gerar PDA" />
              </ListItem>
              <ListItem button component={Link} to="/ships">
                <ListItemIcon sx={{ color: 'primary.main' }}><HomeIcon /></ListItemIcon>
                <ListItemText primary="Navios" />
              </ListItem>
              <ListItem button component={Link} to="/clients">
                <ListItemIcon sx={{ color: 'primary.main' }}><ContactsIcon /></ListItemIcon>
                <ListItemText primary="Clientes" />
              </ListItem>
              <ListItem button component={Link} to="/ports">
                <ListItemIcon sx={{ color: 'primary.main' }}><LocationOnIcon /></ListItemIcon>
                <ListItemText primary="Portos" />
              </ListItem>
            </List>
            <Box sx={{ flexGrow: 1 }} />
            {/* Switch de tema */}
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">{mode === 'dark' ? 'Escuro' : 'Claro'}</Typography>
              <Switch checked={mode === 'dark'} onChange={colorMode.toggleColorMode} color="primary" />
            </Box>
          </Box>
          {/* Main Content */}
          <Box sx={{ flex: 1, p: 4 }}>
            {/* Barra de busca no topo */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
              <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, px: 2, py: 1, display: 'flex', alignItems: 'center', width: 320 }}>
                <SearchIcon sx={{ color: 'primary.main', mr: 1 }} />
                <input
                  type="text"
                  placeholder="Buscar..."
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: theme.palette.text.primary,
                    width: '100%',
                    fontSize: 16
                  }}
                />
              </Box>
            </Box>
            <Typography variant="h4" color="text.primary" gutterBottom>
              Dashboard de Métricas
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
              {/* Cards de Métricas - Placeholders */}
              <Paper sx={{ p: 3, bgcolor: 'background.paper', color: 'text.primary', borderRadius: 3, boxShadow: 2 }}>
                <Typography variant="h6">PDAs por Cliente</Typography>
                <Box sx={{ height: 180 }}>
                  {dataPdasCliente && dataPdasCliente.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dataPdasCliente} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="#b0b8c9" />
                        <YAxis stroke="#b0b8c9" />
                        <Tooltip />
                        <Bar dataKey="pdas" fill="#6ec1e4" radius={[8,8,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 6 }}>
                      Nenhum dado encontrado
                    </Typography>
                  )}
                </Box>
              </Paper>
              <Paper sx={{ p: 3, bgcolor: 'background.paper', color: 'text.primary', borderRadius: 3, boxShadow: 2 }}>
                <Typography variant="h6">PDAs por Porto</Typography>
                <Box sx={{ height: 180 }}>
                  {dataPdasPorto && dataPdasPorto.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dataPdasPorto} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="#b0b8c9" />
                        <YAxis stroke="#b0b8c9" />
                        <Tooltip />
                        <Bar dataKey="pdas" fill="#1976d2" radius={[8,8,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 6 }}>
                      Nenhum dado encontrado
                    </Typography>
                  )}
                </Box>
              </Paper>
              <Paper sx={{ p: 3, bgcolor: 'background.paper', color: 'text.primary', borderRadius: 3, boxShadow: 2 }}>
                <Typography variant="h6">Custos por Porto</Typography>
                <Box sx={{ height: 180 }}>
                  {dataCustosPorto && dataCustosPorto.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={dataCustosPorto} dataKey="custo" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                          {dataCustosPorto.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={pieColors[idx % pieColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 6 }}>
                      Nenhum dado encontrado
                    </Typography>
                  )}
                </Box>
              </Paper>
              <Paper sx={{ p: 3, bgcolor: 'background.paper', color: 'text.primary', borderRadius: 3, boxShadow: 2 }}>
                <Typography variant="h6">Comparativo Navios x Portos</Typography>
                <Box sx={{ height: 180 }}>
                  {dataComparativo && dataComparativo.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dataComparativo} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <XAxis dataKey="name" stroke="#b0b8c9" />
                        <YAxis stroke="#b0b8c9" />
                        <Tooltip />
                        <Legend />
                        {/* Linhas dinâmicas para cada porto */}
                        {dataComparativo.length > 0 && Object.keys(dataComparativo[0]).filter(k => k !== 'name').map((porto, idx) => (
                          <Line key={porto} type="monotone" dataKey={porto} stroke={pieColors[idx % pieColors.length]} strokeWidth={2} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 6 }}>
                      Nenhum dado encontrado
                    </Typography>
                  )}
                </Box>
              </Paper>
              {/* Adicione mais cards conforme necessário */}
            </Box>
          </Box>
        </Box>
  );
};

export default DashboardPage;
