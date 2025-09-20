// frontend/src/pages/CalculationsPage.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../config';
import { Box, Select, MenuItem, Button, TextField, FormControl, InputLabel, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Grid, Typography } from '@mui/material';

const SHIP_VARIABLES = ['@DWT', '@GRT', '@NET', '@LOA', '@BEAM', '@DRAFT', '@DEPTH', '@YEAR', '@TOTAL_CARGO'];
const OPERATORS = ['>', '>=', '<', '<=', '=='];

function CalculationsPage() {
  const [ports, setPorts] = useState([]);
  const [services, setServices] = useState([]);
  const [calculations, setCalculations] = useState([]);
  const [selectedPortId, setSelectedPortId] = useState('');
  
  const initialFormState = { service_id: '', currency: 'USD', calculation_method: 'FIXED', formula: '', conditional_rules: [{ variable: '@GRT', operator: '<=', value: '', result: '' }], conditional_default: '' };
  const [form, setForm] = useState(initialFormState);
  const [loading, setLoading] = useState(true);
  const [editingCalcId, setEditingCalcId] = useState(null);

  const fetchCalculationsForPort = async (portId) => {
      try {
  const calculationsRes = await axios.get(`${API_BASE}/api/calculations/${portId}`);
        setCalculations(calculationsRes.data);
      } catch (error) { console.error("Erro ao buscar cálculos:", error); }
  };

  useEffect(() => {
  axios.get(`${API_BASE}/api/ports`).then(res => setPorts(res.data)).catch(err => console.error(err)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedPortId) {
      setServices([]); setCalculations([]); return;
    }
    const fetchDataForPort = async () => {
      try {
  const [linkedServicesRes] = await Promise.all([ axios.get(`${API_BASE}/api/port-services/${selectedPortId}`)]);
  const allServicesRes = await axios.get(`${API_BASE}/api/services`);
        const linkedIds = new Set(linkedServicesRes.data);
        const filteredServices = allServicesRes.data.filter(s => linkedIds.has(s.id));
        setServices(filteredServices);
        fetchCalculationsForPort(selectedPortId);
      } catch (error) { console.error("Erro ao buscar dados do porto:", error); }
    };
    fetchDataForPort();
  }, [selectedPortId]);

  const handleInputChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); };
  const handleRuleChange = (index, field, value) => {
    const updatedRules = [...form.conditional_rules];
    updatedRules[index][field] = value;
    setForm({ ...form, conditional_rules: updatedRules });
  };
  const handleAddRule = () => { setForm({ ...form, conditional_rules: [...form.conditional_rules, { variable: '@GRT', operator: '<=', value: '', result: '' }] }); };
  const handleRemoveRule = (index) => {
    const updatedRules = form.conditional_rules.filter((_, i) => i !== index);
    setForm({ ...form, conditional_rules: updatedRules });
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    let formulaPayload = form.formula;
    if (form.calculation_method === 'CONDITIONAL') {
      formulaPayload = JSON.stringify({ rules: form.conditional_rules, defaultValue: form.conditional_default });
    }
    try {
  await axios.post(`${API_BASE}/api/calculations`, { port_id: selectedPortId, service_id: form.service_id, currency: form.currency, calculation_method: form.calculation_method, formula: formulaPayload });
      fetchCalculationsForPort(selectedPortId);
      setForm(initialFormState); setEditingCalcId(null);
      alert('Fórmula salva com sucesso!');
    } catch (error) { alert('Erro ao salvar fórmula.'); }
  };
  
  const handleEditClick = (calc) => {
    setEditingCalcId(calc.id);
    if (calc.calculation_method === 'CONDITIONAL') {
      try {
        const conditionalData = JSON.parse(calc.formula);
        setForm({ service_id: calc.service_id, currency: calc.currency, calculation_method: calc.calculation_method, formula: '', conditional_rules: conditionalData.rules, conditional_default: conditionalData.defaultValue });
      } catch (e) { alert("Erro ao ler dados da fórmula condicional para edição."); }
    }
  };

  const handleCancelEdit = () => {
    setEditingCalcId(null);
    setForm(initialFormState);
  };

  const handleDeleteClick = async (calcId) => {
    try {
  await axios.delete(`${API_BASE}/api/calculations/${calcId}`);
      fetchCalculationsForPort(selectedPortId);
    } catch (e) {
      alert('Erro ao excluir cálculo.');
    }
  };

  return (
    <div className="no-print" style={{ background: 'var(--background-default, #181c24)', minHeight: '100vh', padding: '32px 0' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div className="card-action-area" style={{ background: '#fff', borderRadius: '18px', boxShadow: '0 2px 16px 0 rgba(0,0,0,0.10)', padding: '32px 32px 24px 32px', border: 'none' }}>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.5rem', color: '#222' }}>Gerenciar Fórmulas de Serviços</h2>
          <div style={{ margin: '24px 0 0 0' }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="port-select-label">Porto</InputLabel>
              <Select labelId="port-select-label" value={selectedPortId} label="Porto" onChange={e => { setSelectedPortId(e.target.value); handleCancelEdit(); }}>
                <MenuItem value=""><em>Selecione um porto</em></MenuItem>
                {ports.map(port => (
                  <MenuItem key={port.id} value={port.id}>{port.name} - {port.terminal} - {port.berth}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedPortId && (
              <div className="card-action-area" style={{ background: '#f8fafd', borderRadius: '14px', boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)', padding: '24px', marginTop: '8px', border: 'none' }}>
                <form onSubmit={handleSubmit}>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    <FormControl style={{ minWidth: 180 }} size="small" disabled={!!editingCalcId}>
                      <InputLabel>Serviço</InputLabel>
                      <Select name="service_id" value={form.service_id} label="Serviço" onChange={handleInputChange} required>
                        <MenuItem value=""><em>-- Selecione --</em></MenuItem>
                        {services.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <FormControl style={{ minWidth: 120 }} size="small" disabled={!!editingCalcId}>
                      <InputLabel>Moeda</InputLabel>
                      <Select name="currency" value={form.currency} label="Moeda" onChange={handleInputChange}><MenuItem value="USD">USD</MenuItem><MenuItem value="BRL">BRL</MenuItem></Select>
                    </FormControl>
                    <FormControl style={{ minWidth: 180 }} size="small">
                      <InputLabel>Método de Cálculo</InputLabel>
                      <Select name="calculation_method" value={form.calculation_method} label="Método de Cálculo" onChange={handleInputChange}>
                        <MenuItem value="FIXED">Valor Fixo</MenuItem><MenuItem value="FORMULA">Fórmula Livre</MenuItem><MenuItem value="CONDITIONAL">Condicional</MenuItem>
                      </Select>
                    </FormControl>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    {form.calculation_method === 'FIXED' && <TextField type="number" name="formula" label="Valor Fixo" value={form.formula} onChange={handleInputChange} required fullWidth size="small" />}
                    {form.calculation_method === 'FORMULA' && <TextField name="formula" label="Fórmula Livre (Ex: @DWT * 1.25)" value={form.formula} onChange={handleInputChange} required fullWidth size="small"/>}
                    {form.calculation_method === 'CONDITIONAL' && (
                      <div style={{ background: '#fff', borderRadius: '10px', padding: '16px', marginTop: '8px', boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)' }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>SE:</div>
                        {form.conditional_rules.map((rule, index) => (
                          <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: 8 }}>
                            <FormControl style={{ minWidth: 100 }} size="small"><InputLabel>Variável</InputLabel><Select value={rule.variable} onChange={(e) => handleRuleChange(index, 'variable', e.target.value)}>{SHIP_VARIABLES.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}</Select></FormControl>
                            <FormControl style={{ minWidth: 70 }} size="small"><InputLabel>Op.</InputLabel><Select value={rule.operator} onChange={(e) => handleRuleChange(index, 'operator', e.target.value)}>{OPERATORS.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}</Select></FormControl>
                            <TextField label="Valor" type="number" size="small" value={rule.value} onChange={(e) => handleRuleChange(index, 'value', e.target.value)} required style={{ width: 80 }} />
                            <span style={{ fontWeight: 500 }}>ENTÃO</span>
                            <TextField label="Resultado" size="small" value={rule.result} onChange={(e) => handleRuleChange(index, 'result', e.target.value)} required style={{ width: 120 }} />
                            <button type="button" className="header-btn" style={{ color: 'red', background: 'transparent', minWidth: 0, fontWeight: 700 }} onClick={() => handleRemoveRule(index)}>X</button>
                          </div>
                        ))}
                        <button type="button" className="header-btn" style={{ minWidth: 0, fontWeight: 700, marginTop: 8 }} onClick={handleAddRule}>+ Adicionar Regra</button>
                        <TextField label="SENÃO (valor padrão)" value={form.conditional_default} onChange={(e) => setForm({...form, conditional_default: e.target.value})} required fullWidth sx={{ mt: 2 }} size="small" />
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button type="submit" className="header-btn" style={{ minWidth: 0, fontWeight: 700 }}>Salvar Fórmula</button>
                    {editingCalcId && <button type="button" className="header-btn" style={{ minWidth: 0, fontWeight: 700, background: '#eee', color: '#222' }} onClick={handleCancelEdit}>Cancelar Edição</button>}
                  </div>
                </form>
                <div style={{ marginTop: '32px' }}>
                  <h3 style={{ color: '#222', fontWeight: 700, marginBottom: 12 }}>Fórmulas Salvas para este Porto</h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, background: '#fff', borderRadius: '10px', boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)' }}>
                      <thead>
                        <tr style={{ background: '#e3eafc' }}>
                          <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>Serviço</th>
                          <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>Método</th>
                          <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>Moeda</th>
                          <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>Fórmula/Valor</th>
                          <th style={{ padding: '10px 8px', fontWeight: 600, color: '#222' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculations.map(c => (
                          <tr key={c.id}>
                            <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{c.service_name}</td>
                            <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{c.calculation_method}</td>
                            <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{c.currency}</td>
                            <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222', wordBreak: 'break-all' }}>{c.formula}</td>
                            <td style={{ padding: '10px 8px' }}>
                              <button className="header-btn" style={{ minWidth: 0, fontWeight: 700 }} onClick={() => handleEditClick(c)}>Editar</button>
                              <button className="header-btn" style={{ minWidth: 0, fontWeight: 700, color: 'red', background: 'transparent' }} onClick={() => handleDeleteClick(c.id)}>Excluir</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CalculationsPage;