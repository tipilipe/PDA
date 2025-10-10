
import React, { useEffect, useState, useContext } from 'react';
import { Card, Table, TableHead, TableRow, TableCell, TableBody, Typography, CircularProgress, Box, IconButton, Collapse } from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import axios from 'axios';
import { API_BASE } from '../config';
import AuthContext from '../context/AuthContext.jsx';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR').slice(0,5);
}

export default function LogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useContext(AuthContext);
  const [expanded, setExpanded] = useState({});

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    const loadLogs = async () => {
      if (!user?.token) {
        setLoading(false);
        setError('Você precisa estar autenticado para visualizar os logs.');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const { data } = await axios.get(`${API_BASE}/api/logs`);
        setLogs(Array.isArray(data) ? data : []);
      } catch (e) {
        const status = e?.response?.status;
        const msg = status === 401
          ? 'Não autorizado. Faça login novamente.'
          : 'Erro ao carregar logs.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, [user?.token]);

  return (
    <Card sx={{ p: 2, maxHeight: '80vh', overflow: 'auto' }}>
      <Typography variant="h5" gutterBottom>Log de Ações</Typography>
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" height={200}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : !Array.isArray(logs) || logs.length === 0 ? (
        <Typography color="text.secondary">Nenhum log encontrado.</Typography>
      ) : (
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Data/Hora</TableCell>
              <TableCell>Usuário</TableCell>
              <TableCell>Ação</TableCell>
              <TableCell>Entidade</TableCell>
              <TableCell>ID</TableCell>
              <TableCell>Detalhes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map(log => {
              const isExpandable = log.details && String(log.details).length > 40;
              let detailsContent = log.details;
              if (typeof detailsContent !== 'string') {
                try { detailsContent = JSON.stringify(detailsContent, null, 2); } catch { detailsContent = String(detailsContent); }
              }
              return (
                <TableRow key={log.id}>
                  <TableCell>{formatDate(log.created_at)}</TableCell>
                  <TableCell>{log.username || log.user_id}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.entity}</TableCell>
                  <TableCell>{log.entity_id}</TableCell>
                  <TableCell>
                    {isExpandable ? (
                      <Box display="flex" alignItems="flex-start">
                        <IconButton size="small" onClick={() => toggleExpand(log.id)} aria-label={expanded[log.id] ? 'Recolher detalhes' : 'Expandir detalhes'}>
                          {expanded[log.id] ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                        <Box flex={1}>
                          <Collapse in={expanded[log.id]} timeout="auto" unmountOnExit>
                            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 400, fontSize: 12, margin: 0 }}>
                              {detailsContent}
                            </pre>
                          </Collapse>
                          {!expanded[log.id] && (
                            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 400, fontSize: 12, margin: 0, color: '#888' }}>
                              {detailsContent.slice(0, 40)}{detailsContent.length > 40 ? '...' : ''}
                            </pre>
                          )}
                        </Box>
                      </Box>
                    ) : (
                      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 400, fontSize: 12, margin: 0 }}>
                        {detailsContent}
                      </pre>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
