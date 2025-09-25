// frontend/src/components/PrintablePda.jsx
import React from 'react';

const formatDate = (dateString) => {
  if (!dateString) return 'TBA';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'TBA';
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  const adjustedDate = new Date(date.getTime() + timezoneOffset);
  return adjustedDate.toLocaleDateString('en-GB');
};

/**
 * Converte valores que podem vir como number, "1234.56", "1.234,56", "1234,56", null, undefined
 * para Number seguro. Retorna 0 em caso de falha.
 */
const parseNumberSafe = (raw) => {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;

  let s = String(raw).trim();
  if (s === '') return 0;

  const hasDot = s.indexOf('.') !== -1;
  const hasComma = s.indexOf(',') !== -1;

  if (hasDot && hasComma) {
    // ex: "1.234,56" -> "1234.56"
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (!hasDot && hasComma) {
    // ex: "1234,56" -> "1234.56"
    s = s.replace(',', '.');
  } // else assume "1234.56" or "1234"

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const formatPtBR = (num) => {
  const n = Number(num);
  if (!Number.isFinite(n)) return '0,00';
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
};

const PrintablePda = React.forwardRef(({ pdaResult, showBankDetails = true, showBRL = true, showUSD = true, companyProfile = null, selectedBank = '1' }, ref) => {
  if (!pdaResult) return null;

  // Garanta que items exista e seja array
  const itemsArray = Array.isArray(pdaResult.items) ? pdaResult.items : [];

  // Roe numérico seguro
  const roeNum = parseNumberSafe(pdaResult.roe);

  // Normaliza itens e calcula BRL / USD seguro
  const normalizedItems = itemsArray.map(item => {
    const rawVal = parseNumberSafe(item.value);
    const currency = (item.currency || '').toString().toUpperCase();

    let valueBRL = 0;
    let valueUSD = 0;

    if (currency === 'BRL') {
      valueBRL = rawVal;
      valueUSD = roeNum ? rawVal / roeNum : 0;
    } else {
      // assume USD
      valueUSD = rawVal;
      valueBRL = roeNum ? rawVal * roeNum : 0;
    }

    return {
      ...item,
      valueNum: rawVal,
      valueBRL,
      valueUSD,
      formattedBRL: formatPtBR(valueBRL),
      formattedUSD: formatPtBR(valueUSD),
    };
  });

  const totalBRL = normalizedItems.reduce((t, i) => t + (parseNumberSafe(i.valueBRL) || 0), 0);
  const totalUSD = normalizedItems.reduce((t, i) => t + (parseNumberSafe(i.valueUSD) || 0), 0);

  // Empresa do usuário (se vinculado) ou placeholders
  const companyName = companyProfile?.name || 'NOME DA SUA EMPRESA (DO PERFIL)';
  const companySubtitle = companyProfile?.subtitle || '(complemento)';

  // Número da PDA com ano vigente (usa createdAt/eta/etd se existirem)
  const dateForYear = pdaResult?.createdAt || pdaResult?.created_at || pdaResult?.eta || pdaResult?.etd || Date.now();
  const derivedYear = new Date(dateForYear).getFullYear();
  const rawPdaNum = pdaResult?.pda_number || pdaResult?.pdaNumber || '';
  const pdaNumWithYear = rawPdaNum
    ? (String(rawPdaNum).includes('/') ? String(rawPdaNum) : `${rawPdaNum}/${derivedYear}`)
    : '';
  const invoiceTitle = `ESTIMATED PROFORMA INVOICE${pdaNumWithYear ? ' ' + pdaNumWithYear : ''}`;

  return (
  <div ref={ref} className="printable-pda" style={{ fontFamily: 'Inter, Arial, sans-serif', color: '#000', fontSize: '9pt', width: '100%', boxSizing: 'border-box', margin: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '10px' }}>
        <div>
          <h1 style={{ margin: 0, color: '#004080', fontSize: '16pt' }}>{companyName}</h1>
          <p style={{ margin: 0, fontSize: '9pt' }}>{companySubtitle}</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '20px' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '12pt' }}>{invoiceTitle}</h2>
          <p style={{ margin: 0, fontSize: '9pt' }}><strong>To:</strong> {pdaResult.client?.name || '-'}</p>
          <p style={{ margin: 0, fontSize: '9pt' }}><strong>Date:</strong> {new Date().toLocaleDateString('en-GB')}</p>
        </div>
      </div>
      <hr style={{border: 0, borderTop: '2px solid black' }}/>

      <div style={{ marginTop: '15px' }}>
        <p style={{ margin: '5px 0' }}>
          <strong>CARGO/SERVICE:</strong> {pdaResult.cargo || '-'} {pdaResult.totalCargo ? ` - ABOUT ${pdaResult.totalCargo} MT` : ''}
        </p>
        <p style={{fontSize: '8pt', margin: '5px 0'}}>
          <strong>MV {pdaResult.ship?.name || '-' }:</strong> (DWT: {pdaResult.ship?.dwt || '-'} | GRT: {pdaResult.ship?.grT || '-'} | NET: {pdaResult.ship?.net || '-'} | LOA: {pdaResult.ship?.loa || '-'} | BEAM: {pdaResult.ship?.beam || '-'} | DEPTH: {pdaResult.ship?.depth || '-'})
        </p>
      </div>

  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px', border: '1px solid black', fontSize: '9pt', tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2', border: '1px solid black' }}>
            <th style={{ padding: '4px', border: '1px solid black' }}>PO</th>
            <th style={{ padding: '4px', border: '1px solid black' }}>VESSEL</th>
            <th style={{ padding: '4px', border: '1px solid black' }}>PORT</th>
            <th style={{ padding: '4px', border: '1px solid black' }}>ETA</th>
            <th style={{ padding: '4px', border: '1px solid black' }}>ETD</th>
            <th style={{ padding: '4px', border: '1px solid black' }}>R.O.E.</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: '4px', border: '1px solid black', textAlign: 'center' }}>{rawPdaNum || '-'}</td>
            <td style={{ padding: '4px', border: '1px solid black', textAlign: 'center' }}>{pdaResult.ship?.name || '-'}</td>
            <td style={{ padding: '4px', border: '1px solid black', textAlign: 'center' }}>{`${pdaResult.port?.name || '-'}${pdaResult.port ? ` - ${pdaResult.port.terminal || '-'} - ${pdaResult.port.berth || '-'}` : ''}`}</td>
            <td style={{ padding: '4px', border: '1px solid black', textAlign: 'center' }}>{formatDate(pdaResult.eta)}</td>
            <td style={{ padding: '4px', border: '1px solid black', textAlign: 'center' }}>{formatDate(pdaResult.etd)}</td>
            <td style={{ padding: '4px', border: '1px solid black', textAlign: 'center' }}>{formatPtBR(roeNum)}</td>
          </tr>
        </tbody>
      </table>

      <h3 style={{ marginTop: '15px', marginBottom: '5px', fontSize: '10pt' }}>SERVICES DESCRIPTION</h3>
  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid black' }}>
            <th style={{ padding: '4px', textAlign: 'left', width: '60%' }}>DESCRIPTION</th>
            {showBRL && <th style={{ padding: '4px', textAlign: 'right' }}>VALUE (BRL)</th>}
            {showUSD && <th style={{ padding: '4px', textAlign: 'right' }}>VALUE (USD)</th>}
          </tr>
        </thead>
        <tbody>
          {normalizedItems.map((item, index) => (
            <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '4px' }}>{item.service_name || '-'}</td>
              {showBRL && <td style={{ padding: '4px', textAlign: 'right' }}>{item.formattedBRL}</td>}
              {showUSD && <td style={{ padding: '4px', textAlign: 'right' }}>{item.formattedUSD}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ backgroundColor: 'transparent', color: '#000', fontWeight: 700, borderTop: '2px solid #000' }}>
            <td style={{ padding: '8px 6px', fontWeight: 800, fontSize: '10pt', letterSpacing: '.5px' }}>GRAND TOTAL</td>
            {showBRL && <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 800, fontSize: '10pt' }}>{formatPtBR(totalBRL)}</td>}
            {showUSD && <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 800, fontSize: '10pt' }}>{formatPtBR(totalUSD)}</td>}
          </tr>
        </tfoot>
      </table>

      <div style={{marginTop: '20px', pageBreakInside: 'avoid' }}>
        <h3 style={{borderBottom: '1px solid black', paddingBottom: '4px', fontSize: '10pt', margin: '0 0 5px 0'}}>REMARKS</h3>
        {Array.isArray(pdaResult.remarks) && pdaResult.remarks.length > 0 ? (
          pdaResult.remarks.map(remark => (<p key={remark.id || remark.remark_text} style={{whiteSpace: 'pre-wrap', fontSize: '8pt', margin: '4px 0'}}>{remark.remark_text}</p>))
        ) : (
          <p style={{ fontSize: '8pt', color: '#666' }}>No remarks</p>
        )}
      </div>

      {showBankDetails && (
        <div style={{marginTop: '20px', borderTop: '2px solid black', paddingTop: '8px', fontSize: '8pt', pageBreakBefore: 'auto', pageBreakInside: 'avoid'}}>
            <h3 style={{margin: '0 0 5px 0'}}>BANK DETAILS {companyProfile?.name ? `(FROM ${companyProfile.name})` : '(FROM PROFILE)'}</h3>
            {(() => {
              const detail = selectedBank === '2' ? companyProfile?.bank_details_2 : selectedBank === '3' ? companyProfile?.bank_details_3 : companyProfile?.bank_details_1;
              if (!detail) {
                return (
                  <p style={{margin: '2px 0', color: '#666'}}>No bank details available.</p>
                );
              }
              // Espera-se que o campo já venha formatado (linhas de texto). Apenas exibimos.
              return String(detail).split('\n').map((line, idx) => (
                <p key={idx} style={{margin: '2px 0'}}>{line}</p>
              ));
            })()}
        </div>
      )}
    </div>
  );
});

export default PrintablePda;
