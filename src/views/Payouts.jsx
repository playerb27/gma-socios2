import React, { useState, useMemo, useRef } from 'react';
import { supabase } from '../supabase';
import { uploadFile } from '../utils/storage';
import FileButton from '../components/FileButton';
import { 
  DollarSign, 
  Calendar, 
  CheckCircle2, 
  CreditCard,
  Plus,
  ArrowRight,
  FileText,
  Upload,
  X,
  Search,
  History,
  Settings,
  Briefcase,
  Loader2,
  User
} from 'lucide-react';

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useGmaData } from '../hooks/useGmaData';
import { formatCurrency, normalizeSocioName } from '../utils/dataHelpers';

const Payouts = () => {
  const { cashflow, retornos, inversiones, socios, settings, loading } = useGmaData();
  
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [paymentForm, setPaymentForm] = useState({
    partner: null,
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    concept: '',
    files: []
  });

  // Helper function to normalize name (using the shared helper)
  const norm = (name) => normalizeSocioName(name);

  const monthlyPayoutsData = useMemo(() => {
    if (!cashflow || !inversiones) return [];

    const totalInvInicial = inversiones.reduce((sum, i) => sum + i.cantidad, 0);
    const invByPartner = {};
    inversiones.forEach(inv => {
      const name = inv.nombreInversionista;
      invByPartner[name] = (invByPartner[name] || 0) + inv.cantidad;
    });

    let remainingGlobalInvestment = totalInvInicial;
    const partnerBalances = {}; // Track cumulative balance globally through timeline

    const sortedFlows = [...cashflow].sort((a, b) => a.mes.localeCompare(b.mes));

    return sortedFlows.map(flow => {
      const uOperativa = Number(flow.utilidad || 0);
      const sueldoDocFix = Number(flow.sueldoDoctor || 95000);
      
      const excedenteRepartible = Math.max(0, uOperativa - sueldoDocFix);
      
      const rules = flow.rules || settings?.rules || { 
        recovery: { investor: 85, doctor: 15 }, 
        profit: { investor: 66.6, doctor: 33.3 } 
      };

      let investorPool = 0;
      let doctorVariableShare = 0;

      if (excedenteRepartible > 0) {
        if (remainingGlobalInvestment <= 0) {
          investorPool = excedenteRepartible * (rules.profit.investor / 100);
          doctorVariableShare = excedenteRepartible * (rules.profit.doctor / 100);
        } else {
          const utilNecesariaParaRecuperar = remainingGlobalInvestment / (rules.recovery.investor / 100);
          if (excedenteRepartible <= utilNecesariaParaRecuperar) {
            investorPool = excedenteRepartible * (rules.recovery.investor / 100);
            doctorVariableShare = excedenteRepartible * (rules.recovery.doctor / 100);
            remainingGlobalInvestment -= investorPool;
          } else {
            const partialRecoveryInv = remainingGlobalInvestment;
            const partialRecoveryDoc = (remainingGlobalInvestment / (rules.recovery.investor / 100)) * (rules.recovery.doctor / 100);
            const sobranteUtilidad = excedenteRepartible - (partialRecoveryInv + partialRecoveryDoc);
            investorPool = partialRecoveryInv + (sobranteUtilidad * (rules.profit.investor / 100));
            doctorVariableShare = partialRecoveryDoc + (sobranteUtilidad * (rules.profit.doctor / 100));
            remainingGlobalInvestment = 0;
          }
        }
      }

      // Generate suggested row for each unique partner
      const rawPayouts = Object.keys(invByPartner).map(name => ({
        name,
        amount: investorPool * (invByPartner[name] / (totalInvInicial || 1)),
        isDoctor: name === 'DR. EDUARDO'
      }));

      // Add actual Doctor entry if not added (The doctor usually isn't an "investor")
      const existingDocIndex = rawPayouts.findIndex(p => p.name === 'DR. EDUARDO');
      if (existingDocIndex === -1) {
        rawPayouts.push({ 
          name: 'DR. EDUARDO', 
          amount: doctorVariableShare + sueldoDocFix, 
          isDoctor: true 
        });
      } else {
        rawPayouts[existingDocIndex].amount += (doctorVariableShare + sueldoDocFix);
      }

      const paidThisMonth = retornos.filter(r => r.payoutMonth === flow.mes);

      const finalPayouts = rawPayouts.map(sp => {
        const prevBalance = partnerBalances[sp.name] || 0;
        
        let retenido = 0;
        if (flow.itemsIngresos) {
           flow.itemsIngresos.forEach(ing => {
              if (norm(ing.concept).includes(norm(sp.name)) || norm(sp.name).includes(norm(ing.concept))) {
                 retenido += Number(ing.amount);
              }
           });
        }

        const targetSugerido = sp.amount;

        let gastosPagados = 0;
        const allGastos = [...(flow.itemsFijos || []), ...(flow.itemsVariables || [])];
        allGastos.forEach(g => {
           if (g.paidBy === sp.name) {
               gastosPagados += Number(g.amount);
           }
        });
        
        const paidBy = r => r.paidBy && norm(r.paidBy) === norm(sp.name);
        
        const paidThisMonthArr = paidThisMonth;

        const paidToThem = paidThisMonthArr
          .filter(r => norm(r.nombreInversionista) === norm(sp.name) && !r.isReintegro)
          .reduce((sum, r) => sum + r.cantidad, 0);

        const saldosPagadosAOtros = paidThisMonthArr
          .filter(r => r.paidBy === sp.name)
          .reduce((sum, r) => sum + r.cantidad, 0);

        // Total a liquidar = (Sugerido Mes + Saldo Anterior Favor + Egresos pagados de su bolsa + Pagos cruzados a otros) - Dinero Retenido en Terminal
        const netOwed = (targetSugerido + prevBalance + gastosPagados + saldosPagadosAOtros) - retenido;

        const paid = paidToThem;
        
        const nextCarryingBalance = netOwed - paid;
        partnerBalances[sp.name] = nextCarryingBalance;

        return { ...sp, paid, prevBalance, retenido, gastosPagados, saldosPagadosAOtros, targetSugerido, netOwed, nextCarryingBalance };
      });

      return {
        ...flow,
        payoutRows: finalPayouts,
        totalSuggested: finalPayouts.reduce((sum, p) => sum + p.targetSugerido, 0),
        totalPaid: finalPayouts.reduce((sum, p) => sum + p.paid, 0),
        isFullPaid: finalPayouts.every(p => p.nextCarryingBalance <= 1) // Tolerance
      };
    }).reverse();
  }, [cashflow, inversiones, retornos, settings]);

  const handleOpenPayment = (monthRow, partner) => {
    setSelectedMonth(monthRow);
    setPaymentForm({
      partner: partner,
      amount: Math.max(0, partner.netOwed).toFixed(2),
      suggested: partner.netOwed,
      date: format(new Date(), 'yyyy-MM-dd'),
      concept: `Liquidación utilidades - Periodo ${monthRow.mes}`,
      payer: 'Fondo Clínica',
      files: []
    });
    setIsPaymentModalOpen(true);
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const newFiles = [];
      for (const file of files) {
        const path = await uploadFile(file, 'payouts');
        newFiles.push({ url: path, name: file.name });
      }
      setPaymentForm(prev => ({ ...prev, files: [...prev.files, ...newFiles] }));
    } catch (error) {
      alert('Error subiendo archivos');
    } finally {
      setUploading(false);
    }
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) return alert("Monto inválido");

    try {
      const partnerName = norm(paymentForm.partner.name);
      const selectedSocio = socios.find(s => norm(s.nombre) === partnerName);
      
      let finalCategoria = 'recuperacion';
      if (paymentForm.partner.isDoctor) {
        finalCategoria = Number(paymentForm.amount) <= Number(selectedMonth.sueldoDoctor) ? 'sueldo' : 'utilidad';
      } else {
        finalCategoria = selectedMonth.fase?.includes('UTILIDAD') ? 'utilidad' : 'recuperacion';
      }

      const returnData = {
        cantidad: Number(paymentForm.amount),
        fecha: new Date(paymentForm.date).toISOString(),
        socioId: selectedSocio?.id || 'manual',
        nombreInversionista: paymentForm.partner.name,
        tipo: 'dinero',
        categoria: finalCategoria,
        payoutMonth: selectedMonth.mes, // Linking 
        paidBy: paymentForm.payer, // Cross checking who paid it
        createdAt: new Date().toISOString(),
        fileUrls: paymentForm.files.map(f => f.url),
        descripcion: paymentForm.concept
      };

      await supabase.from('returns').insert({
        ...returnData,
        file_urls: returnData.fileUrls,
        nombre_inversionista: returnData.nombreInversionista,
        payout_month: returnData.payoutMonth,
        paid_by: returnData.paidBy,
        created_at: returnData.createdAt,
        socio_id: returnData.socioId
      });
      alert('Pago registrado con éxito');
      setIsPaymentModalOpen(false);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  if (loading) {
     return (
       <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
         <Loader2 className="animate-spin" size={48} />
         <p style={{ marginTop: '1rem' }}>Sincronizando estatus de pagos...</p>
       </div>
     );
   }

  return (
    <div className="payouts-view">
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Estatus de Pagos</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Control de repartos sugeridos vs pagos ejecutados por mes.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {monthlyPayoutsData.map((month) => (
          <div key={month.id} className="card" style={{ padding: '0', overflow: 'hidden', borderLeft: month.isFullPaid ? '6px solid var(--success)' : '6px solid var(--warning)' }}>
            <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)' }}>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase' }}>
                  {format(parseISO(month.mes + '-01'), 'MMMM yyyy', { locale: es })}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Utilidad: <strong>{formatCurrency(month.utilidad)}</strong> | Fase: <strong>{month.fase || '---'}</strong>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`status-badge ${month.isFullPaid ? 'status-dinero' : 'status-bienes'}`}>
                  {month.isFullPaid ? 'Totalmente Pagado' : 'Pendiente de Pago'}
                </span>
                <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.7 }}>
                   Total Pagado: {formatCurrency(month.totalPaid)} / {formatCurrency(month.totalSuggested)}
                </div>
              </div>
            </div>

            <div className="table-container" style={{ marginTop: 0, border: 'none', borderRadius: 0, overflowX: 'auto' }}>
              <table style={{ minWidth: '1000px' }}>
                <thead>
                  <tr>
                    <th>Socio / Terminal</th>
                    <th style={{ textAlign: 'right' }}>Utilidad Mes</th>
                    <th style={{ textAlign: 'right' }}>Arrastre Anterior</th>
                    <th style={{ textAlign: 'right', color: 'var(--accent-secondary)' }}>Aportó Egresos</th>
                    <th style={{ textAlign: 'right', color: 'var(--success)' }}>Cobrado Terminal</th>
                    <th style={{ textAlign: 'right', background: 'rgba(255,255,255,0.02)' }}>Balance a Liquidar</th>
                    <th style={{ textAlign: 'right' }}>Transferido</th>
                    <th style={{ textAlign: 'right' }}>Adeudo Final</th>
                    <th style={{ textAlign: 'center' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {month.payoutRows.map((p, idx) => {
                    const absBalance = Math.abs(p.nextCarryingBalance);
                    const isOwe = p.nextCarryingBalance < -1; // They owe the pool
                    const isOwed = p.nextCarryingBalance > 1; // Pool owes them

                    return (
                      <tr key={idx} style={{ background: p.isDoctor ? 'rgba(99,102,241,0.03)' : 'transparent' }}>
                        <td style={{ fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {p.isDoctor ? <Briefcase size={14} color="var(--accent-primary)" /> : <User color="var(--accent-secondary)" size={14} />}
                            {p.name}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(p.targetSugerido)}</td>
                        <td style={{ textAlign: 'right', color: p.prevBalance > 1 ? 'var(--error)' : p.prevBalance < -1 ? 'var(--success)' : 'inherit' }}>
                          {formatCurrency(p.prevBalance)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--accent-secondary)', fontWeight: 600, opacity: p.gastosPagados > 0 ? 1 : 0.3 }}>
                          {formatCurrency(p.gastosPagados)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)', opacity: p.retenido > 0 ? 1 : 0.3 }}>
                          {formatCurrency(p.retenido)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, background: 'rgba(255,255,255,0.02)', color: p.netOwed < 0 ? 'var(--success)' : 'inherit' }}>
                          {formatCurrency(p.netOwed)}
                          {p.netOwed < 0 && <span style={{fontSize: '0.65rem', display: 'block', fontWeight: 'normal'}}>(Aportar al Grupo)</span>}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--accent-primary)', fontWeight: 600 }}>{formatCurrency(p.paid)}</td>
                        <td style={{ textAlign: 'right', color: isOwed ? 'var(--warning)' : isOwe ? 'var(--success)' : 'inherit', fontWeight: 700 }}>
                          {isOwed ? `Adeudo: ${formatCurrency(absBalance)}` : isOwe ? `Debe Rgt: ${formatCurrency(absBalance)}` : '✓ AL DÍA'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            className={`btn ${isOwed ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                            onClick={() => handleOpenPayment(month, p)}
                            disabled={!isOwed}
                          >
                            <CreditCard size={14} /> Saldar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {monthlyPayoutsData.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-secondary)' }}>
            <Calendar size={48} style={{ marginBottom: '1.5rem', opacity: 0.2 }} />
            <h3>No hay registros de flujo de caja cerrados</h3>
            <p>Primero cierra un mes en la sección de "Flujo de Caja" para ver repartos.</p>
          </div>
        )}
      </div>

      {isPaymentModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3>Registrar Pago: {paymentForm.partner?.name}</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)' }}><X size={20}/></button>
            </div>
            
            <form onSubmit={submitPayment}>
              <div className="form-group" style={{ opacity: 0.7 }}>
                <label>Monto Objetivo (Sugerido + Arrastre)</label>
                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.75rem', fontSize: '1.25rem', fontWeight: 700 }}>
                  {formatCurrency(paymentForm.suggested)}
                </div>
              </div>

              <div className="form-group">
                <label>Monto Real Pagado</label>
                <div style={{ position: 'relative' }}>
                  <DollarSign size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                  <input 
                    type="number" 
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                    style={{ paddingLeft: '2.25rem', fontSize: '1.75rem', fontWeight: 800, color: 'var(--success)' }}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                 <label>Cobrado / Fondeado desde:</label>
                 <select 
                    value={paymentForm.payer} 
                    onChange={(e) => setPaymentForm({...paymentForm, payer: e.target.value})}
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                 >
                    <option value="Fondo Clínica">Fondo Fijo / Cuenta Central (Clínica)</option>
                    {selectedMonth?.payoutRows.map(p => {
                       const balanceText = p.nextCarryingBalance < -1 
                          ? `(Tiene fondos: ${formatCurrency(Math.abs(p.nextCarryingBalance))})` 
                          : p.nextCarryingBalance > 1 
                             ? `(Se le deben ${formatCurrency(p.nextCarryingBalance)})` 
                             : `(Balance en $0)`;
                       return (
                          <option key={p.name} value={p.name}>{p.name} {balanceText}</option>
                       );
                    })}
                 </select>
                 {paymentForm.payer !== 'Fondo Clínica' && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)', marginTop: '0.5rem' }}>
                       ⚡ Esto ajustará el balance del pagador ({paymentForm.payer}) reduciendo su deuda retenida o sumándolo como saldo a favor, transformándolo virtualmente en una aportación al fondeo operativo.
                    </div>
                 )}
              </div>

              <div className="form-group">
                <label>Fecha de Operación</label>
                <input type="date" value={paymentForm.date} onChange={(e) => setPaymentForm({...paymentForm, date: e.target.value})} required />
              </div>

              <div className="form-group">
                <label>Concepto / Referencia</label>
                <input type="text" value={paymentForm.concept} onChange={(e) => setPaymentForm({...paymentForm, concept: e.target.value})} placeholder="Referencia bancaria o No. Ticket" />
              </div>

              <div className="form-group">
                <label>Comprobante</label>
                <div 
                  onClick={() => fileInputRef.current.click()}
                  style={{ border: '2px dashed var(--glass-border)', padding: '1rem', borderRadius: '0.75rem', textAlign: 'center', cursor: 'pointer' }}
                >
                  <input type="file" hidden ref={fileInputRef} onChange={handleFileChange} multiple />
                  <Upload size={20} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                  <div style={{ fontSize: '0.75rem' }}>{uploading ? 'Subiendo...' : 'Adjuntar Comprobante'}</div>
                </div>
                {paymentForm.files.map((f, i) => (
                  <div key={i} style={{ fontSize: '0.7rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '0.4rem', borderRadius: '0.4rem' }}>
                    <span>{f.name}</span>
                    <CheckCircle2 size={12} color="var(--success)" />
                  </div>
                ))}
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={uploading}>
                Confirmar Pago
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payouts;
