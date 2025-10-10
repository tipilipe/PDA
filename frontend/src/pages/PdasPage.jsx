// frontend/src/pages/PdasPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../config';
import PrintablePda from '../components/PrintablePda';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableItem } from '../components/SortableItem';

function PdasPage() {
  const location = useLocation();
  const componentRef = useRef();
  const [ships, setShips] = useState([]);
  const [ports, setPorts] = useState([]);
  const [clients, setClients] = useState([]);
  const [allServices, setAllServices] = useState([]);
  const [savedPdas, setSavedPdas] = useState([]);
  const [selectedShipId, setSelectedShipId] = useState('');
  const [selectedPortId, setSelectedPortId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [roe, setRoe] = useState('');
  const [pdaNumber, setPdaNumber] = useState('');
  const [cargo, setCargo] = useState('');
  const [totalCargo, setTotalCargo] = useState('');
  const [eta, setEta] = useState('');
  const [etb, setEtb] = useState('');
  const [etd, setEtd] = useState('');
  const [loading, setLoading] = useState(true);
  const [pdaResult, setPdaResult] = useState(null);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pdasPage, setPdasPage] = useState(1); // paginação do painel lateral
  const PDAS_PAGE_SIZE = 20;
  const [isPrinting, setIsPrinting] = useState(false);
  const [displayItems, setDisplayItems] = useState([]);
  const [showBankDetails, setShowBankDetails] = useState(true);
  const [showBRL, setShowBRL] = useState(true);
  const [showUSD, setShowUSD] = useState(true);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [selectedBank, setSelectedBank] = useState('1');
  const [suppressedTaxes, setSuppressedTaxes] = useState(new Set()); // nomes de taxas removidas manualmente

  const TAX_LABELS = {
    municipal: 'MUNICIPAL TAX',
    bank: 'BANK CHARGES',
    federal: 'FEDERAL GOVERNMENTAL FINANCIAL TAX',
  };

  // Ordem fixa para taxas e utilitários
  const TAX_ORDER = [TAX_LABELS.municipal, TAX_LABELS.bank, TAX_LABELS.federal];
  const isTaxNameGlobal = (name) => TAX_ORDER.includes(String(name || '').trim().toUpperCase());
  // Ordena os itens da PDA conforme a ordem dos serviços vinculados ao porto
  const orderItemsWithTaxesStable = (items) => {
    // Busca a ordem dos serviços vinculados ao porto selecionado
    let linkedServiceOrder = [];
    if (selectedPortId && Array.isArray(allServices) && allServices.length > 0) {
      // allServices contém todos os serviços, mas precisamos da ordem dos vinculados
      // A ordem dos vinculados está em port_services, mas aqui não está disponível diretamente
      // Então usamos a ordem dos serviços que aparecem em items (que vieram do backend já filtrados)
      linkedServiceOrder = items
        .filter(it => it.service_name && !TAX_ORDER.includes(String(it.service_name).trim().toUpperCase()))
        .map(it => String(it.service_name).trim().toUpperCase());
    }
    const base = [];
    const map = new Map();
    for (const it of items) {
      const lbl = String(it.service_name || '').trim().toUpperCase();
      if (TAX_ORDER.includes(lbl)) map.set(lbl, it); else base.push(it);
    }
    // Ordena base conforme linkedServiceOrder
    let orderedBase = base;
    if (linkedServiceOrder.length > 0) {
      orderedBase = [...base].sort((a, b) => {
        const ia = linkedServiceOrder.indexOf(String(a.service_name).trim().toUpperCase());
        const ib = linkedServiceOrder.indexOf(String(b.service_name).trim().toUpperCase());
        return ia - ib;
      });
    }
    const taxes = TAX_ORDER.map(l => map.get(l)).filter(Boolean);
    const result = [...orderedBase, ...taxes];
    if (result.length === items.length && result.every((x, i) => x === items[i])) return items;
    return result;
  };

  const formatPtBR = (num) => {
    const n = Number(num);
    if (!Number.isFinite(n)) return '0,00';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  };

  const parsePtBR = (s) => {
    if (s === null || s === undefined) return 0;
    const str = String(s).trim();
    if (!str) return 0;
    // remove separador de milhar e troca vírgula por ponto
    const normalized = str.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? n : 0;
  };

  // Aceita tanto pt-BR ("1.234,56") quanto ponto-decimal ("1234.56")
  const parseAnyNumber = (s) => {
    if (s === null || s === undefined) return 0;
    const str = String(s).trim();
    if (!str) return 0;
    if (str.includes(',')) return parsePtBR(str);
    const n = parseFloat(str);
    return Number.isFinite(n) ? n : 0;
  };

  const getBankLabel = (details, fallbackLabel) => {
    if (!details || typeof details !== 'string') return fallbackLabel;
    const lines = details.split('\n').map(s => s.trim()).filter(Boolean);
    const firstLine = lines[0] || '';
    // Try find bank name
    let bankName = '';
    for (const ln of lines) {
      const m = ln.match(/^(?:BENEFICIARY\s*BANK|BANK|BANCO)\s*:?\s*(.+)$/i);
      if (m && m[1]) { bankName = m[1].replace(/[\[\]]/g,'').trim(); break; }
    }
    if (!bankName) {
      bankName = firstLine.replace(/[\[\]]/g,'').trim();
    }
    // Try find agency/account
    let agency = '';
    let account = '';
    for (const ln of lines) {
      const ag = ln.match(/AGENC(?:IA|Y)\s*:?\s*([\w.-]+)/i);
      if (ag && ag[1]) agency = ag[1];
      const ac = ln.match(/(?:ACCOUNT|CONTA)\s*:?\s*([\w.-]+)/i);
      if (ac && ac[1]) account = ac[1];
    }
    const extra = agency || account ? ` – Ag ${agency || '-'} / Cc ${account || '-'}` : '';
    const label = `${bankName}${extra}`.trim();
    return label || fallbackLabel;
  };

  // Helpers para totais robustos (espelham PrintablePda)
  const parseNumberSafe = (raw) => {
    if (raw === null || raw === undefined) return 0;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
    let s = String(raw).trim();
    if (s === '') return 0;
    const hasDot = s.indexOf('.') !== -1;
    const hasComma = s.indexOf(',') !== -1;
    if (hasDot && hasComma) s = s.replace(/\./g, '').replace(',', '.');
    else if (!hasDot && hasComma) s = s.replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };
  const getRoeNum = () => parseNumberSafe(roe || pdaResult?.roe || 0);
  const normCurrency = (c) => String(c || '').trim().toUpperCase();
  const normalizeItemValues = (it) => {
    const v = parseNumberSafe(it.value);
    const cur = normCurrency(it.currency);
    const r = getRoeNum();
    if (cur === 'BRL') {
      return { brl: v, usd: r ? v / r : 0 };
    }
    return { brl: r ? v * r : 0, usd: v };
  };
  const totalBRLAll = (items) => items.reduce((t, it) => t + normalizeItemValues(it).brl, 0);
  const totalUSDAll = (items) => items.reduce((t, it) => t + normalizeItemValues(it).usd, 0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Print robusto: aguarda ciclo de renderização para evitar página em branco
  const handlePrint = async () => {
    if (!pdaResult || isPrinting) return;
    setIsPrinting(true);
    const sanitize = (s) => String(s || '')
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
    const pdaNo = pdaNumber || pdaResult?.pda_number || 'PDA';
    const shipName = pdaResult?.ship?.name || '';
    const portName = pdaResult?.port?.name || '';
    const clientName = pdaResult?.client?.name || '';
    const desired = [pdaNo, shipName, portName, clientName].filter(Boolean).map(sanitize).join(' - ');
    const prevTitle = document.title;
    const nextTitle = desired || prevTitle;
    const restore = () => { document.title = prevTitle; window.removeEventListener('afterprint', restore); setIsPrinting(false); };
    window.addEventListener('afterprint', restore, { once: true });
    document.title = nextTitle;
    // Garante que o componente de impressão está no DOM e layout calculado
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    // Força reflow explícito (lê altura)
    const el = document.querySelector('.printable-area');
    if (el) void el.offsetHeight; // eslint-disable-line no-unused-expressions
    // Timeout mínimo para permitir aplicação de estilos de mídia print
    setTimeout(() => {
      try { window.print(); } catch { restore(); }
    }, 20);
  };

  useEffect(() => {
    if (pdaResult) {
      // Garante uniqueId em pdaResult.items
      const ensuredItems = pdaResult.items.map((item, index) => {
        const base = (item.service_name || '').toUpperCase();
        const uid = item.uniqueId || `${index}-${base}`;
        return { ...item, uniqueId: uid };
      });
      // Se havia itens sem uniqueId, atualiza o estado uma única vez
      const hadMissing = pdaResult.items.some((it, idx) => !it.uniqueId);
      if (hadMissing) {
        setPdaResult(prev => ({ ...prev, items: ensuredItems }));
      }
  const roeNum = parseFloat(String(pdaResult.roe).replace(',', '.')) || 0;
  let itemsCore = ensuredItems;

  // Auto-cálculo de taxas: apenas se serviços carregados e itens existirem
      if (allServices.length > 0 && itemsCore.length > 0) {
        const sup = suppressedTaxes;
        const serviceMap = new Map(allServices.map(s => [String(s.name || '').trim().toUpperCase(), !!s.is_taxable]));
        const isTaxName = (name) => isTaxNameGlobal(name);
        const toBRL = (it) => {
          const v = parseFloat(it.value) || 0;
          return (String(it.currency || '').toUpperCase() === 'BRL') ? v : (roeNum ? v * roeNum : 0);
        };
        const baseItems = itemsCore.filter(it => !isTaxName(it.service_name));
        const totalBRLBase = baseItems.reduce((t, it) => t + toBRL(it), 0);
        const taxableBRL = baseItems.reduce((t, it) => {
          const key = String(it.service_name || '').trim().toUpperCase();
          return serviceMap.get(key) ? t + toBRL(it) : t;
        }, 0);

        const municipalBRL = taxableBRL * 0.05;
        const bankBRL = 250;
        const federalBRL = totalBRLBase * 0.0038;

        const upsertTax = (arr, label, valueBRL, uid) => {
          const idx = arr.findIndex(x => String(x.service_name || '').trim().toUpperCase() === label);
          const isSuppressed = sup.has(label);
          if (isSuppressed) {
            // remove caso exista
            if (idx === -1) return arr;
            return arr.filter((_, i) => i !== idx);
          }
          if (idx >= 0) {
            const existing = arr[idx];
            if (existing.autoCalc === false) return arr; // manual, não mexe
            const cur = parseFloat(existing.value) || 0;
            const same = Math.abs(cur - valueBRL) < 0.005 && String(existing.currency).toUpperCase() === 'BRL';
            if (same) return arr; // nenhuma alteração
            const copy = [...arr];
            copy[idx] = { ...existing, value: valueBRL, currency: 'BRL', autoCalc: true };
            return copy;
          }
          if ((label === TAX_LABELS.municipal || label === TAX_LABELS.federal) && valueBRL <= 0) return arr;
          return [...arr, { service_name: label, value: valueBRL, currency: 'BRL', uniqueId: uid, autoCalc: true }];
        };

        let nextItems = itemsCore;
        nextItems = upsertTax(nextItems, TAX_LABELS.municipal, municipalBRL, 'tax-municipal');
        nextItems = upsertTax(nextItems, TAX_LABELS.bank, bankBRL, 'tax-bank');
        nextItems = upsertTax(nextItems, TAX_LABELS.federal, federalBRL, 'tax-federal');

        const ordered = orderItemsWithTaxesStable(nextItems);
        if (ordered !== itemsCore) {
          itemsCore = ordered;
          setPdaResult(prev => ({ ...prev, items: itemsCore }));
        }
      }

      const itemsWithDisplayValues = itemsCore.map((item) => {
        const raw = parseNumberSafe(item.value);
        const isBRL = String(item.currency).toUpperCase() === 'BRL';
        const vBRL = isBRL ? raw : (roeNum ? raw * roeNum : 0);
        const vUSD = isBRL ? (roeNum ? raw / roeNum : 0) : raw;
        return {
          ...item,
          displayBRL: formatPtBR(vBRL),
          displayUSD: formatPtBR(vUSD)
        };
      });
      setDisplayItems(itemsWithDisplayValues);
    } else {
      setDisplayItems([]);
    }
  }, [pdaResult, allServices, suppressedTaxes]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [shipsRes, portsRes, clientsRes, savedPdasRes, servicesRes, companyRes] = await Promise.all([
  axios.get(`${API_BASE}/api/ships`),
  axios.get(`${API_BASE}/api/ports`),
  axios.get(`${API_BASE}/api/clients`),
  axios.get(`${API_BASE}/api/pda`),
  axios.get(`${API_BASE}/api/services`),
  axios.get(`${API_BASE}/api/company/profile`).catch(() => ({ data: null }))
      ]);
      setShips(shipsRes.data);
      setPorts(portsRes.data);
      setClients(clientsRes.data);
      setSavedPdas(savedPdasRes.data);
      setAllServices(servicesRes.data);
  setCompanyProfile(companyRes?.data?.company || null);
      // Seleciona a primeira conta disponível por padrão
  const cp = companyRes?.data?.company || {};
      const firstAvailable = cp.bank_details_1 ? '1' : cp.bank_details_2 ? '2' : cp.bank_details_3 ? '3' : '1';
      setSelectedBank(firstAvailable);
    } catch (err) { setError('Falha ao carregar dados iniciais.'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchInitialData(); }, []);

  // Detect navigation from AcervoPage with openPdaId and auto-load PDA
  useEffect(() => {
    if (location && location.state && location.state.openPdaId) {
      const pdaId = location.state.openPdaId;
      if (pdaId) {
        handleOpenPda(pdaId);
      }
    }
    // eslint-disable-next-line
  }, [location]);

  const handleGeneratePda = async () => {
    if (!selectedShipId || !selectedPortId || !roe || !selectedClientId) { alert('Por favor, selecione um Navio, Cliente, Porto e informe a ROE.'); return; }
    try {
      setLoading(true); setError(''); setPdaResult(null);
      const numericRoe = parseFloat(roe.replace(',', '.'));
  const response = await axios.post(`${API_BASE}/api/pda/calculate`, { 
        ship_id: selectedShipId, port_id: selectedPortId, client_id: selectedClientId, roe: numericRoe, 
        totalCargo, cargo, pdaNumber, eta, etb, etd 
      });
      setPdaResult(response.data);
    } catch (err) { setError('Ocorreu um erro ao gerar a PDA. Verifique o console.'); } finally { setLoading(false); }
  };

  const handleSavePda = async () => {
    if (!pdaResult) { alert("Primeiro, gere uma PDA para poder salvar."); return; }
    try {
      const pdaToSave = { ...pdaResult, pdaNumber, cargo, totalCargo, eta, etb, etd };
      // Remove o uniqueId temporário antes de salvar
      pdaToSave.items = pdaToSave.items.map(({ uniqueId, ...rest }) => rest);
  const response = await axios.post(`${API_BASE}/api/pda/save`, { pdaData: pdaToSave });
      alert(response.data.message);
      fetchInitialData();
    } catch (err) { alert("Erro ao salvar a PDA."); }
  };

  const handleOpenPda = async (pdaId) => {
    try {
      setLoading(true); setError('');
  const response = await axios.get(`${API_BASE}/api/pda/${pdaId}`);
      const loadedPda = response.data;
      setSelectedClientId(loadedPda?.client?.id || '');
      setSelectedShipId(loadedPda?.ship?.id || '');
      setSelectedPortId(loadedPda?.port?.id || '');
      setRoe(String(loadedPda?.roe ?? ''));
      setPdaNumber(loadedPda?.pda_number || '');
      setCargo(loadedPda?.cargo || '');
      setTotalCargo(loadedPda?.totalCargo || '');
      setEta(loadedPda?.eta?.split('T')[0] || '');
      setEtb(loadedPda?.etb?.split('T')[0] || '');
      setEtd(loadedPda?.etd?.split('T')[0] || '');
      const normalized = { ...loadedPda, remarks: Array.isArray(loadedPda?.remarks) ? loadedPda.remarks : [] };
      setPdaResult(normalized);
    } catch (err) { setError("Não foi possível carregar a PDA selecionada."); } finally { setLoading(false); }
  };

  const handleDisplayChange = (uniqueId, field, value) => {
    const newDisplayItems = displayItems.map(item => {
      if (item.uniqueId === uniqueId) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setDisplayItems(newDisplayItems);
  };
  
  const handleValueCommit = (uniqueId, currencyField) => {
    const newItems = [...pdaResult.items];
    const itemIndex = newItems.findIndex(item => item.uniqueId === uniqueId);
    if (itemIndex === -1) return;

    const item = { ...newItems[itemIndex] };
    const displayItem = displayItems.find(d => d.uniqueId === uniqueId) || {};

    const numericRoe = parseFloat(String(pdaResult.roe).replace(',', '.')) || 0;
    let numericValue = 0;

    if (currencyField === 'BRL') {
      numericValue = parsePtBR(displayItem.displayBRL);
      item.value = item.currency === 'BRL' ? numericValue : numericValue / numericRoe;
    } else {
      numericValue = parsePtBR(displayItem.displayUSD);
      item.value = item.currency === 'USD' ? numericValue : numericValue * numericRoe;
    }

    // Se for taxa, marcar como edição manual
    const nameUpper = String(item.service_name || '').trim().toUpperCase();
    if (nameUpper === TAX_LABELS.municipal || nameUpper === TAX_LABELS.bank || nameUpper === TAX_LABELS.federal) {
      item.autoCalc = false;
    }
    newItems[itemIndex] = item;
    setPdaResult({ ...pdaResult, items: newItems });

    // Atualiza imediatamente os displays para feedback instantâneo
    setDisplayItems(prev => prev.map(d => {
      if (d.uniqueId !== uniqueId) return d;
      const valueBRL = item.currency === 'BRL' ? item.value : (numericRoe ? item.value * numericRoe : 0);
      const valueUSD = item.currency === 'USD' ? item.value : (numericRoe ? item.value / numericRoe : 0);
      return { ...d, displayBRL: formatPtBR(valueBRL), displayUSD: formatPtBR(valueUSD) };
    }));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const isTaxName = (name) => {
      const u = String(name || '').trim().toUpperCase();
      return u === TAX_LABELS.municipal || u === TAX_LABELS.bank || u === TAX_LABELS.federal;
    };
    const baseItems = pdaResult.items.filter(it => !isTaxName(it.service_name));
    const taxItems = pdaResult.items.filter(it => isTaxName(it.service_name));
    const baseIds = baseItems.map(i => i.uniqueId);
    const oldIndex = baseIds.indexOf(active.id);
    const newIndex = baseIds.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reorderedBase = arrayMove(baseItems, oldIndex, newIndex);
    const newItems = [...reorderedBase, ...taxItems];
    setPdaResult(prev => ({ ...prev, items: newItems }));
    // opcionalmente atualizar displayItems para feedback imediato
    const byId = new Map(newItems.map(it => [it.uniqueId, it]));
    setDisplayItems(prev => prev
      .map(di => byId.get(di.uniqueId))
      .filter(Boolean)
      .map(it => {
        const r = parseFloat(String(pdaResult.roe).replace(',', '.')) || 0;
        const isBRL = String(it.currency).toUpperCase() === 'BRL';
        const raw = parseFloat(it.value) || 0;
        const vBRL = isBRL ? raw : (r ? raw * r : 0);
        const vUSD = isBRL ? (r ? raw / r : 0) : raw;
        return { ...it, displayBRL: formatPtBR(vBRL), displayUSD: formatPtBR(vUSD) };
      })
    );
  };

  const handleAddItem = () => {
    const newItem = {
      uniqueId: `new-${Date.now()}`, // ID único e estável
      service_name: '',
      value: 0,
      currency: 'USD'
    };
    setPdaResult(prev => {
      const arr = Array.isArray(prev.items) ? [...prev.items] : [];
      const idx = arr.findIndex(it => isTaxNameGlobal(it.service_name));
      if (idx >= 0) arr.splice(idx, 0, newItem); else arr.push(newItem);
      return { ...prev, items: orderItemsWithTaxesStable(arr) };
    });
  };

  const handleRemoveItem = (uniqueId) => {
    const removed = pdaResult.items.find(item => item.uniqueId === uniqueId);
    const newItems = pdaResult.items.filter(item => item.uniqueId !== uniqueId);
    setPdaResult(prev => ({
      ...prev,
      items: newItems
    }));
    // Se removeu uma taxa, não re-adicionar automaticamente
    if (removed) {
      const label = String(removed.service_name || '').trim().toUpperCase();
      if (label === TAX_LABELS.municipal || label === TAX_LABELS.bank || label === TAX_LABELS.federal) {
        setSuppressedTaxes(prev => new Set([...prev, label]));
      }
    }
  };

  const handleItemServiceChange = (uniqueId, newServiceName) => {
    const newItems = pdaResult.items.map(item => {
      if (item.uniqueId === uniqueId) {
        return { ...item, service_name: String(newServiceName || '').toUpperCase() };
      }
      return item;
    });
    setPdaResult(prev => ({ ...prev, items: orderItemsWithTaxesStable(newItems) }));
  };

  const filteredPdas = savedPdas.filter(pda => (pda.pda_number && pda.pda_number.toLowerCase().includes(searchTerm.toLowerCase())) || (pda.client_name && pda.client_name.toLowerCase().includes(searchTerm.toLowerCase())) || (pda.ship_name && pda.ship_name.toLowerCase().includes(searchTerm.toLowerCase())) || (pda.port_name && pda.port_name.toLowerCase().includes(searchTerm.toLowerCase())));
  const totalPdasPages = Math.max(1, Math.ceil(filteredPdas.length / PDAS_PAGE_SIZE));
  const safePage = Math.min(pdasPage, totalPdasPages);
  const paginatedPdas = filteredPdas.slice((safePage - 1) * PDAS_PAGE_SIZE, safePage * PDAS_PAGE_SIZE);
  useEffect(() => { // reset page quando filtro muda
    setPdasPage(1);
  }, [searchTerm]);
  
  return (
    <>
      <div className="no-print" style={{ background: 'var(--background-default, #181c24)', minHeight: '100vh', padding: '32px 0' }}>
        <div className="pda-layout">
          {/* Área principal (formulário + resultado) */}
          <div className="pda-main">
            <div className="pda-card">
              <h2 className="pda-title">Generate Proforma Disbursement Account (PDA)</h2>
              <div className="pda-form-grid">
                <select className="themed-input" value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}><option value="">-- CLIENT --</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <select className="themed-input" value={selectedShipId} onChange={(e) => setSelectedShipId(e.target.value)}><option value="">-- VESSEL --</option>{ships.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <select className="themed-input" value={selectedPortId} onChange={(e) => setSelectedPortId(e.target.value)}><option value="">-- PORT --</option>{ports.map(p => <option key={p.id} value={p.id}>{`${p.name} - ${p.terminal} - ${p.berth}`}</option>)}</select>
                <input className="themed-input" type="text" placeholder="R.O.E." value={roe} onChange={(e) => setRoe(e.target.value)} />
                <input className="themed-input" type="text" placeholder="PDA NUMBER" value={pdaNumber} onChange={(e) => setPdaNumber(e.target.value)} />
                <input className="themed-input" type="text" placeholder="CARGO DESCRIPTION" value={cargo} onChange={(e) => setCargo(e.target.value)} />
                <input className="themed-input" type="number" placeholder="TOTAL CARGO (MT)" value={totalCargo} onChange={(e) => setTotalCargo(e.target.value)} />
                <div className="pda-date-field"><label>ETA</label><input className="themed-input" type="date" value={eta} onChange={(e) => setEta(e.target.value)} /></div>
                <div className="pda-date-field"><label>ETB</label><input className="themed-input" type="date" value={etb} onChange={(e) => setEtb(e.target.value)} /></div>
                <div className="pda-date-field"><label>ETD</label><input className="themed-input" type="date" value={etd} onChange={(e) => setEtd(e.target.value)} /></div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <button className="header-btn" onClick={handleGeneratePda} disabled={loading} style={{ whiteSpace:'nowrap' }}>{loading ? 'CALCULATING...' : 'GENERATE PDA'}</button>
                </div>
              </div>
              {error && <div style={{ color: 'red', marginTop: 12, fontSize: '.8rem' }}>{error}</div>}
            </div>

            {pdaResult && (
              <div className="pda-card" style={{ marginTop:'32px', marginBottom:'32px' }}>
                <h3 style={{ fontWeight: 700, color: '#222', marginBottom: 8 }}>PDA RESULT FOR CLIENT: {pdaResult.client?.name || '-'}</h3>
                <h4 style={{ fontWeight: 500, color: '#444', marginBottom: 24 }}>VESSEL: {pdaResult.ship?.name || '-'} | PORT: {pdaResult.port?.name || '-'} - {pdaResult.port?.terminal || '-'} - {pdaResult.port?.berth || '-'}</h4>
                <div className="pda-table-wrapper">
                  {/* Tabela principal (somente itens base) */}
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, marginTop: 0, background: '#f8fafd', borderRadius: '12px', boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)' }}>
                      <thead>
                        <tr style={{ background: '#e3eafc' }}>
                          <th style={{ width: '20px', padding: '10px 8px' }}></th>
                          <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: '#222' }}>SERVICE DESCRIPTION</th>
                          <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: '#222' }}>VALUE (BRL)</th>
                          <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: '#222' }}>VALUE (USD)</th>
                          <th style={{ width: '50px', padding: '10px 8px' }}>ACTION</th>
                        </tr>
                      </thead>
                      {(() => {
                        const isTax = (n) => {
                          const u = String(n || '').trim().toUpperCase();
                          return u === TAX_LABELS.municipal || u === TAX_LABELS.bank || u === TAX_LABELS.federal;
                        };
                        const displayBaseItems = displayItems.filter(i => !isTax(i.service_name));
                        return (
                          <SortableContext items={displayBaseItems.map(i => i.uniqueId)} strategy={verticalListSortingStrategy}>
                            <tbody>
                              {displayBaseItems.map((item) => (
                                <SortableItem key={item.uniqueId} id={item.uniqueId}>
                                  <td>
                                    <input
                                      list="services-datalist"
                                      value={item.service_name}
                                      onChange={(e) => handleItemServiceChange(item.uniqueId, e.target.value)}
                                      className="themed-input"
                                      style={{ width: '100%', border: 'none', backgroundColor: 'transparent', color: 'inherit', textTransform: 'uppercase', fontWeight: 500 }}
                                      placeholder="Digite ou selecione um serviço"
                                    />
                                  </td>
                                  <td><input type="text" value={item.displayBRL} onChange={(e) => handleDisplayChange(item.uniqueId, 'displayBRL', e.target.value)} onBlur={() => handleValueCommit(item.uniqueId, 'BRL')} className="themed-input" style={{ width: '100%', border: 'none', backgroundColor: 'transparent', color: 'inherit', textTransform: 'uppercase', fontWeight: 500 }} /></td>
                                  <td><input type="text" value={item.displayUSD} onChange={(e) => handleDisplayChange(item.uniqueId, 'displayUSD', e.target.value)} onBlur={() => handleValueCommit(item.uniqueId, 'USD')} className="themed-input" style={{ width: '100%', border: 'none', backgroundColor: 'transparent', color: 'inherit', textTransform: 'uppercase', fontWeight: 500 }} /></td>
                                  <td><button className="header-btn" style={{ color: 'red', backgroundColor: 'transparent', minWidth: 0, padding: '0 8px' }} onClick={(e) => { e.stopPropagation(); handleRemoveItem(item.uniqueId); }} >(-)</button></td>
                                </SortableItem>
                              ))}
                            </tbody>
                          </SortableContext>
                        );
                      })()}
                    </table>
                  </DndContext>

                  {/* Quadro de taxas fixas acima do GRAND TOTAL (mesmo alinhamento do quadro superior) */}
                  {(() => {
                    const isTax = (n) => {
                      const u = String(n || '').trim().toUpperCase();
                      return u === TAX_LABELS.municipal || u === TAX_LABELS.bank || u === TAX_LABELS.federal;
                    };
                    const taxes = displayItems.filter(i => isTax(i.service_name));
                    if (taxes.length === 0) return null;
                    const roeNum = getRoeNum();
                    return (
                      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, marginTop: '16px', background: '#f8fafd', borderRadius: '12px', boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)' }}>
                        <thead>
                          <tr style={{ background: '#e3eafc' }}>
                            <th style={{ width: '20px', padding: '10px 8px' }}></th>
                            <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700, color: '#222' }} colSpan={4}>ADDITIONAL CHARGES</th>
                          </tr>
                          <tr style={{ background: '#e3eafc' }}>
                            <th style={{ width: '20px', padding: '10px 8px' }}></th>
                            <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: '#222' }}>DESCRIPTION</th>
                            <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: '#222' }}>VALUE (BRL)</th>
                            <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600, color: '#222' }}>VALUE (USD)</th>
                            <th style={{ width: '50px', padding: '10px 8px' }}>ACTION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {taxes.map((tx) => (
                            <tr key={tx.uniqueId}>
                              <td style={{ width: '20px', padding: '10px 8px' }}></td>
                              <td style={{ padding: '10px 8px', fontWeight: 500, color: '#222' }}>{tx.service_name}</td>
                              <td style={{ padding: '10px 8px' }}>
                                <input type="text" value={tx.displayBRL} onChange={(e) => handleDisplayChange(tx.uniqueId, 'displayBRL', e.target.value)} onBlur={() => handleValueCommit(tx.uniqueId, 'BRL')} className="themed-input" style={{ width: '100%', border: 'none', backgroundColor: 'transparent', color: 'inherit', textTransform: 'uppercase', fontWeight: 500 }} />
                              </td>
                              <td style={{ padding: '10px 8px', color: '#222', fontWeight: 600 }}>{formatPtBR(roeNum ? parsePtBR(tx.displayBRL) / roeNum : 0)}</td>
                              <td style={{ padding: '10px 8px' }}>
                                <button className="header-btn" style={{ color: 'red', backgroundColor: 'transparent', minWidth: 0, padding: '0 8px' }} onClick={() => handleRemoveItem(tx.uniqueId)} >(-)</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}

                  {/* Linha de GRAND TOTAL */}
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, marginTop: '12px', background: '#f8fafd', borderRadius: '12px', boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)' }}>
                    <tbody>
                      <tr style={{ background: '#e3eafc' }}>
                        <th style={{ width: '20px', padding: '10px 8px' }}></th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700, color: '#222' }}>GRAND TOTAL</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700, color: '#222' }}>{formatPtBR(totalBRLAll(pdaResult.items))}</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 700, color: '#222' }}>{formatPtBR(totalUSDAll(pdaResult.items))}</th>
                        <th style={{ width: '50px' }}></th>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <datalist id="services-datalist">
                  {allServices.map(service => <option key={service.id} value={service.name} />)}
                </datalist>
                <button className="header-btn" onClick={handleAddItem} style={{ marginTop: '18px', minWidth: 0, fontWeight: 700 }}>(+) Add New Item</button>
                <div className="pda-actions-wrap">
                  <button className="header-btn" onClick={handleSavePda} style={{ minWidth: 0, fontWeight: 700 }}>SAVE PDA</button>
                  <button className="header-btn" onClick={handlePrint} disabled={!pdaResult || isPrinting} style={{ backgroundColor: '#3f51b5', color: 'white', minWidth: 0, fontWeight: 700, opacity: (!pdaResult || isPrinting) ? .6 : 1 }}>{isPrinting ? 'PREPARING...' : 'PRINT / GENERATE PDF'}</button>
                  <fieldset style={{ border: '1px solid #ccc', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px', borderRadius: '8px', background: '#f8fafd' }}><legend style={{ fontSize: '12px' }}>Print Options</legend>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}><input type="checkbox" checked={showBankDetails} onChange={() => setShowBankDetails(!showBankDetails)} /> BANK DETAILS</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}><input type="checkbox" checked={showBRL} onChange={() => setShowBRL(!showBRL)} /> BRL COLUMN</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}><input type="checkbox" checked={showUSD} onChange={() => setShowUSD(!showUSD)} /> USD COLUMN</label>
                  </fieldset>
                  {/* Seletor de conta bancária */}
                  {companyProfile && (companyProfile.bank_details_1 || companyProfile.bank_details_2 || companyProfile.bank_details_3) && (
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#222', marginBottom: '6px' }}>Bank Account</label>
                      <select className="themed-input" value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)}>
                        {companyProfile.bank_details_1 && <option value="1">{getBankLabel(companyProfile.bank_details_1, 'Conta 1')}</option>}
                        {companyProfile.bank_details_2 && <option value="2">{getBankLabel(companyProfile.bank_details_2, 'Conta 2')}</option>}
                        {companyProfile.bank_details_3 && <option value="3">{getBankLabel(companyProfile.bank_details_3, 'Conta 3')}</option>}
                      </select>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: '32px' }}><h3 style={{ color: '#222', fontWeight: 700 }}>REMARKS</h3>{(Array.isArray(pdaResult.remarks) ? pdaResult.remarks : []).map(remark => (<p key={remark.id || remark.remark_text} style={{ whiteSpace: 'pre-wrap', color: '#444', fontWeight: 500, fontSize:'.85rem' }}>{remark.remark_text}</p>))}</div>
              </div>
            )}
          </div>

          {/* Área lateral: últimas PDAs salvas */}
          <div className="pda-card pda-card--compact pda-side" style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <h3 style={{ fontWeight: 700, color: '#222', margin:0, fontSize:'clamp(.82rem,1.1vw + .4rem,1.05rem)' }}>LAST SAVED PDAs</h3>
            <input className="themed-input" type="text" placeholder="SEARCH..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '6px 10px', margin:0, boxSizing: 'border-box', fontSize:'.72rem' }}/>
            <div style={{ borderRadius:10, background:'#f8fafd', boxShadow:'0 1px 4px 0 rgba(0,0,0,0.04)', overflow:'hidden', width:'100%' }}>
              <table style={{ width: '100%', borderCollapse:'separate', borderSpacing:0, textAlign:'left', fontSize:'.65rem', tableLayout:'fixed' }}>
                <thead>
                  <tr style={{ background:'#e3eafc' }}>
                    <th style={{ padding:'6px 6px', fontWeight:600, color:'#222' }}>PDA</th>
                    <th style={{ padding:'6px 6px', fontWeight:600, color:'#222' }}>CLIENT</th>
                    <th style={{ padding:'6px 6px', fontWeight:600, color:'#222' }}>VESSEL</th>
                    <th style={{ padding:'6px 6px', fontWeight:600, color:'#222' }}>PORT</th>
                    <th style={{ padding:'6px 6px', fontWeight:600, color:'#222', width:'64px', textAlign:'center' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPdas.map(pda => (
                    <tr key={pda.id} style={{ borderBottom:'1px solid #e0e7ef' }}>
                      <td style={{ padding:'6px 6px', fontWeight:500, color:'#222' }}>{pda.pda_number}</td>
                      <td style={{ padding:'6px 6px', fontWeight:500, color:'#222', whiteSpace:'nowrap', maxWidth:90, overflow:'hidden', textOverflow:'ellipsis' }}>{pda.client_name}</td>
                      <td style={{ padding:'6px 6px', fontWeight:500, color:'#222', whiteSpace:'nowrap', maxWidth:100, overflow:'hidden', textOverflow:'ellipsis' }}>{pda.ship_name}</td>
                      <td style={{ padding:'6px 6px', fontWeight:500, color:'#222', whiteSpace:'nowrap', maxWidth:90, overflow:'hidden', textOverflow:'ellipsis' }}>{pda.port_name}</td>
                      <td style={{ padding:'4px 6px', width:'64px', textAlign:'center' }}>
                        <button
                          aria-label="Open"
                          title="Open"
                          className="header-btn btn-sm"
                          style={{
                            width:'36px', height:'28px',
                            display:'inline-flex', alignItems:'center', justifyContent:'center',
                            padding:0, margin:'0 2px',
                            background:'#3f51b5', color:'#fff',
                            border:'none', borderRadius:'8px',
                            boxShadow:'0 1px 4px 0 rgba(0,0,0,0.08)',
                            cursor:'pointer',
                          }}
                          onClick={() => handleOpenPda(pda.id)}
                          onMouseOver={e => e.currentTarget.style.background='#283593'}
                          onMouseOut={e => e.currentTarget.style.background='#3f51b5'}
                        >
                          {/* folder-open icon */}
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M3 8V6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2"/>
                            <path d="M6.3 8H20a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2.1H8.2a2 2 0 0 1-1.9-1.3L3 9.4A2 2 0 0 1 4.9 8z"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {paginatedPdas.length === 0 && (
                    <tr><td colSpan={5} style={{ padding:'8px', fontSize:'.65rem', textAlign:'center', color:'#555' }}>No results</td></tr>
                  )}
                </tbody>
              </table>
              {/* Paginação */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 6px', background:'#e3eafc', gap:6 }}>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <button className="btn btn-sm" style={{ padding:'2px 6px', fontSize:'.55rem' }} disabled={safePage===1} onClick={() => setPdasPage(p => Math.max(1, p-1))}>Prev</button>
                  <button className="btn btn-sm" style={{ padding:'2px 6px', fontSize:'.55rem' }} disabled={safePage===totalPdasPages} onClick={() => setPdasPage(p => Math.min(totalPdasPages, p+1))}>Next</button>
                </div>
                <div style={{ fontSize:'.58rem', fontWeight:600 }}>Page {safePage} / {totalPdasPages}</div>
                <div style={{ fontSize:'.55rem', opacity:.7 }}>{filteredPdas.length} total</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="printable-area" aria-hidden="false">
        <div className="print-wrapper" style={{ display:'block' }}>
          <PrintablePda
            ref={componentRef}
            pdaResult={pdaResult ? { ...pdaResult, pda_number: pdaNumber || pdaResult.pda_number } : null}
            showBankDetails={showBankDetails}
            showBRL={showBRL}
            showUSD={showUSD}
            companyProfile={companyProfile}
            selectedBank={selectedBank}
          />
        </div>
      </div>
    </>
  );
}

export default PdasPage;