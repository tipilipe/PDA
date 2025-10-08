import React, { useEffect, useState } from 'react';
import { Card, Table, TableHead, TableRow, TableCell, TableBody, Typography, CircularProgress, Box } from '@mui/material';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR').slice(0,5);
}

export default function LogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/logs')
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(data => {
        setLogs(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Erro ao carregar logs.');
        setLoading(false);
      });
  }, []);

  return (
    <Card sx={{ p: 2, maxHeight: '80vh', overflow: 'auto' }}>
      <Typography variant="h5" gutterBottom>Log de Ações</Typography>
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" height={200}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography color="error">{error}</Typography>
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
            {logs.map(log => (
              <TableRow key={log.id}>
                <TableCell>{formatDate(log.created_at)}</TableCell>
                <TableCell>{log.username || log.user_id}</TableCell>
                <TableCell>{log.action}</TableCell>
                <TableCell>{log.entity}</TableCell>
                <TableCell>{log.entity_id}</TableCell>
                <TableCell>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 300, fontSize: 12 }}>
                    {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                  </pre>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
