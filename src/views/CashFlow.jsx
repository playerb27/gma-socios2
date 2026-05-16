import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabase';
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Save, 
  Trash2, 
  AlertCircle,
  History,
  CheckCircle2,
  X,
  Plus,
  Loader2,
  ChevronDown,
  ChevronRight,
  Calculator,
  Briefcase,
  FileText,
  Edit2,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useGmaData } from '../hooks/useGmaData';
import { formatCurrency, formatNumber } from '../utils/dataHelpers';

const CashFlow = () => {
  const { cashflow, inversiones, settings, loading, stats } = useGmaData();
  const [isClosingMonth, setIsClosingMonth] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showCloseMonth, setShowCloseMonth] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewingDetails, setViewingDetails] = useState(null);
  const [error, setError] = useState(null);

  // Form State for Detailed Month Closure
  const [formMes, setFormMes] = useState(format(new Date(), 'yyyy-MM'));
  const [formSueldoDoctor, setFormSueldoDoctor] = useState('95000');

  const getDefaultTerminals = () => [
    { concept: 'Terminal DR. EDUARDO', amount: '' },
    { concept: 'Terminal GRUPO DENTAL ANTEA', amount: '' },
    { concept: 'Terminal Federico Baena Quijano', amount: '' },
    { concept: 'Terminal Federico de Jesus Baena Ymay', amount: '' }
  ];

  const [itemsIngresos, setItemsIngresos] = useState(getDefaultTerminals());
  
  const [itemsFijos, setItemsFijos] = useState([
    { concept: 'Renta Local', amount: '', paidBy: 'Clínica (Fondo)' },
    { concept: 'Sueldos fijos (Nómina)', amount: '', paidBy: 'Clínica (Fondo)' },
    { concept: 'Luz y Agua', amount: '', paidBy: 'Clínica (Fondo)' },
    { concept: 'Teléfono / Internet', amount: '', paidBy: 'Clínica (Fondo)' },
    { concept: 'Software de Gestión', amount: '', paidBy: 'Clínica (Fondo)' }
  ]);

  const [itemsVariables, setItemsVariables] = useState([
    { concept: 'Insumos Médicos', amount: '', paidBy: 'Clínica (Fondo)' },
    { concept: 'Mantenimiento / Reparaciones', amount: '', paidBy: 'Clínica (Fondo)' },
    { concept: 'Marketing / Publicidad', amount: '', paidBy: 'Clínica (Fondo)' }
  ]);

  const payerOptions = ['Clínica (Fondo)', 'DR. EDUARDO', 'GRUPO DENTAL ANTEA', 'Federico Baena Quijano', 'Federico de Jesus Baena Ymay'];

  // Calculations for current form
  const totals = useMemo(() => {
    const fijos = itemsFijos.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const variables = itemsVariables.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const ingresos = itemsIngresos.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const utilidad = ingresos - fijos - variables;
    return { fijos, variables, total: fijos + variables, ingresos, utilidad };
  }, [itemsFijos, itemsVariables, itemsIngresos]);

  // Evolution Data logic (keeps stats for partners)
  const evolutionData = useMemo(() => {
    if (!cashflow || !inversiones) return [];
    const totalInvInicial = inversiones.reduce((sum, i) => sum + i.cantidad, 0);
    const sortedFlows = [...cashflow].sort((a, b) => a.mes.localeCompare(b.mes));
    
    let remainingGlobalInvestment = totalInvInicial;
    
    return sortedFlows.map(flow => {
      const uOperativa = Number(flow.utilidad || 0);
      const sueldoDocFix = Number(flow.sueldoDoctor || 95000);
      
      const excedenteRepartible = Math.max(0, uOperativa - sueldoDocFix);

      const rules = flow.rules || settings?.rules || { 
        recovery: { investor: 85, doctor: 15 }, 
        profit: { investor: 66.6, doctor: 33.3 } 
      };

      let currentPhase = 'RECUPERACIÓN';
      let investorPool = 0;
      let doctorVariableShare = 0;

      if (excedenteRepartible > 0) {
        if (remainingGlobalInvestment <= 0) {
          currentPhase = 'UTILIDAD';
          investorPool = excedenteRepartible * (rules.profit.investor / 100);
          doctorVariableShare = excedenteRepartible * (rules.profit.doctor / 100);
        } else {
          const utilNecesariaParaRecuperar = remainingGlobalInvestment / (rules.recovery.investor / 100);
          if (excedenteRepartible <= utilNecesariaParaRecuperar) {
            investorPool = excedenteRepartible * (rules.recovery.investor / 100);
            doctorVariableShare = excedenteRepartible * (rules.recovery.doctor / 100);
            remainingGlobalInvestment -= investorPool;
          } else {
            currentPhase = 'MIXTO (TRANSICIÓN)';
            const partialRecoveryInv = remainingGlobalInvestment;
            const partialRecoveryDoc = (remainingGlobalInvestment / (rules.recovery.investor / 100)) * (rules.recovery.doctor / 100);
            const sobranteUtilidad = excedenteRepartible - (partialRecoveryInv + partialRecoveryDoc);
            investorPool = partialRecoveryInv + (sobranteUtilidad * (rules.profit.investor / 100));
            doctorVariableShare = partialRecoveryDoc + (sobranteUtilidad * (rules.profit.doctor / 100));
            remainingGlobalInvestment = 0;
          }
        }
      }

      return {
        ...flow,
        fase: currentPhase,
        totalInversionistas: investorPool,
        totalDoctor: doctorVariableShare + sueldoDocFix,
        faltanteSueldo: Math.max(0, sueldoDocFix - Math.max(0, uOperativa))
      };
    }).reverse();
  }, [cashflow, inversiones, settings]);

  const handleAddItem = (type) => {
    if (type === 'fijo') setItemsFijos([...itemsFijos, { concept: '', amount: '', paidBy: 'Clínica (Fondo)' }]);
    else if (type === 'ingreso') setItemsIngresos([...itemsIngresos, { concept: '', amount: '' }]);
    else setItemsVariables([...itemsVariables, { concept: '', amount: '', paidBy: 'Clínica (Fondo)' }]);
  };

  const handleRemoveItem = (type, index) => {
    if (type === 'fijo') setItemsFijos(itemsFijos.filter((_, i) => i !== index));
    else if (type === 'ingreso') setItemsIngresos(itemsIngresos.filter((_, i) => i !== index));
    else setItemsVariables(itemsVariables.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (type, index, field, value) => {
    const setter = type === 'fijo' ? setItemsFijos : type === 'ingreso' ? setItemsIngresos : setItemsVariables;
    const items = type === 'fijo' ? itemsFijos : type === 'ingreso' ? itemsIngresos : itemsVariables;
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setter(newItems);
  };

  const handleOpenEdit = (flow) => {
    setEditingId(flow.id);
    setFormMes(flow.mes);
    setItemsIngresos(flow.itemsIngresos || [{ concept: 'Ingreso Consolidado', amount: flow.ingresos }]);
    setFormSueldoDoctor(flow.sueldoDoctor || '95000');
    setItemsFijos(flow.itemsFijos?.map(i => ({ ...i, paidBy: i.paidBy || 'Clínica (Fondo)' })) || [{ concept: 'Total Fijos', amount: flow.gastosFijos, paidBy: 'Clínica (Fondo)' }]);
    setItemsVariables(flow.itemsVariables?.map(i => ({ ...i, paidBy: i.paidBy || 'Clínica (Fondo)' })) || [{ concept: 'Total Variables', amount: flow.gastosVariables, paidBy: 'Clínica (Fondo)' }]);
    setShowCloseMonth(true);
  };

  const handleCreateMonth = async (e) => {
    e.preventDefault();
    setIsClosingMonth(true);
    setError(null);

    if (!editingId) {
      const checkDuplicate = cashflow.find(f => f.mes === formMes);
      if (checkDuplicate) {
        setError("Ya existe un registro para este mes.");
        setIsClosingMonth(false);
        return;
      }
    }

    try {
      const payload = {
        mes: formMes,
        ingresos: totals.ingresos,
        gastosFijos: totals.fijos,
        gastosVariables: totals.variables,
        sueldoDoctor: Number(formSueldoDoctor),
        utilidad: totals.utilidad,
        itemsIngresos: itemsIngresos.filter(i => i.concept && i.amount),
        itemsFijos: itemsFijos.filter(i => i.concept && i.amount),
        itemsVariables: itemsVariables.filter(i => i.concept && i.amount),
        rules: settings?.rules || { recovery: { investor: 85, doctor: 15 }, profit: { investor: 66.6, doctor: 33.3 } },
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await supabase.from('cashflow').update(payload).eq('id', editingId);
        alert('Cierre de mes actualizado.');
      } else {
        await supabase.from('cashflow').insert({ ...payload, created_at: new Date().toISOString() });
        alert('Cierre de mes exitoso.');
      }
      
      setShowCloseMonth(false);
      setEditingId(null);
      setItemsIngresos(getDefaultTerminals());
      setItemsFijos([
        { concept: 'Renta Local', amount: '', paidBy: 'Clínica (Fondo)' },
        { concept: 'Sueldos fijos (Nómina)', amount: '', paidBy: 'Clínica (Fondo)' },
        { concept: 'Luz y Agua', amount: '', paidBy: 'Clínica (Fondo)' },
        { concept: 'Teléfono / Internet', amount: '', paidBy: 'Clínica (Fondo)' },
        { concept: 'Software de Gestión', amount: '', paidBy: 'Clínica (Fondo)' }
      ]);
      setItemsVariables([
        { concept: 'Insumos Médicos', amount: '', paidBy: 'Clínica (Fondo)' },
        { concept: 'Mantenimiento / Reparaciones', amount: '', paidBy: 'Clínica (Fondo)' },
        { concept: 'Marketing / Publicidad', amount: '', paidBy: 'Clínica (Fondo)' }
      ]);
    } catch (err) {
      console.error(err);
      setError("Error al guardar el cierre.");
    } finally {
      setIsClosingMonth(false);
    }
  };

  const deleteFlow = async (id) => {
    if (window.confirm('¿Eliminar este registro histórico?')) {
      await supabase.from('cashflow').delete().eq('id', id);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        <Loader2 className="animate-spin" size={48} />
        <p style={{ marginTop: '1rem' }}>Sincronizando estados financieros...</p>
      </div>
    );
  }

  return (
    <div className="cashflow-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800 }}>Finanzas Operativas</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Control detallado de ingresos, egresos y reparto de utilidades.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
           <button className="btn btn-secondary" onClick={() => setShowConfig(true)} title="Ver porcentajes de reparto">
             <Briefcase size={18} /> Reglas
           </button>
           <button className="btn btn-primary" onClick={() => setShowCloseMonth(true)}>
             <Plus size={18} /> Nuevo Cierre de Mes
           </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Main Financial Stats */}
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', margin: 0 }}>
           <div className="card" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), transparent)', border: '1px solid var(--accent-primary)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <div>
                  <span className="card-title">Recuperación Total</span>
                  <div className="card-value" style={{ color: 'var(--accent-primary)' }}>{stats.recoveryProgress.toFixed(1)}%</div>
               </div>
               <Calculator size={24} color="var(--accent-primary)" />
             </div>
             <p style={{ fontSize: '0.75rem', marginTop: '1rem', opacity: 0.8 }}>
               Inversionistas han recuperado **{formatCurrency(stats.totalReturnedToInvestors)}** de los {formatCurrency(stats.totalInvested)} invertidos.
             </p>
           </div>
           
           <div className="card" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), transparent)', border: '1px solid var(--success)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <div>
                  <span className="card-title">Utilidad Promedio</span>
                  {(() => {
                    const avg = evolutionData.length > 0 ? evolutionData.reduce((s,f) => s + Number(f.utilidad), 0) / evolutionData.length : 0;
                    return (
                      <div className="card-value" style={{ color: avg >= 0 ? 'var(--success)' : 'var(--error)' }}>
                        {formatCurrency(avg)}
                      </div>
                    );
                  })()}
               </div>
               <TrendingUp size={24} color="var(--success)" />
             </div>
             <p style={{ fontSize: '0.75rem', marginTop: '1rem', opacity: 0.8 }}>Promedio calculado sobre los últimos {evolutionData.length} meses cerrados.</p>
           </div>
        </div>

        {/* Historical Table with Detail View */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><History size={20} color="var(--accent-primary)" /> Evolución Mensual</h3>
             <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.75rem', borderRadius: '1rem' }}>MUESTRA DETALLES AL TOCAR</span>
          </div>
          
          <div className="table-container" style={{ marginTop: 0, border: 'none', borderRadius: 0, maxHeight: '600px', overflow: 'auto' }}>
            <table style={{ width: '100%', minWidth: '1000px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-secondary)' }}>
                <tr>
                  <th>Periodo</th>
                  <th>Estatus</th>
                  <th style={{ textAlign: 'right' }}>Ventas</th>
                  <th style={{ textAlign: 'right' }}>Egresos</th>
                  <th style={{ textAlign: 'right' }}>Utilidad Neta</th>
                  <th style={{ textAlign: 'right', color: 'var(--accent-primary)' }}>Pool Inversores</th>
                  <th style={{ textAlign: 'right' }}>Pago Doctor</th>
                  <th style={{ textAlign: 'right', color: 'var(--warning)' }}>Aport. Inversores</th>
                  <th style={{ textAlign: 'center' }}>Detalle</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {evolutionData.map((flow) => (
                  <tr key={flow.id}>
                    <td style={{ fontWeight: 700, textTransform: 'capitalize' }}>{format(parseISO(flow.mes + '-01'), 'MMMM yyyy', { locale: es })}</td>
                    <td>
                      <span className="status-badge" style={{ 
                        background: flow.fase.includes('UTILIDAD') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)', 
                        color: flow.fase.includes('UTILIDAD') ? 'var(--success)' : 'var(--accent-primary)' 
                      }}>{flow.fase}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(flow.ingresos)}</td>
                    <td style={{ textAlign: 'right', opacity: 0.7 }}>{formatCurrency(Number(flow.gastosFijos) + Number(flow.gastosVariables))}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: flow.utilidad >= 0 ? 'var(--success)' : 'var(--error)' }}>{formatCurrency(flow.utilidad)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent-primary)', fontWeight: 600 }}>{formatCurrency(flow.totalInversionistas)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(flow.totalDoctor)}</td>
                    <td style={{ textAlign: 'right', color: flow.faltanteSueldo > 0 ? 'var(--warning)' : 'inherit', fontWeight: flow.faltanteSueldo > 0 ? 800 : 400, opacity: flow.faltanteSueldo > 0 ? 1 : 0.2 }}>
                      {flow.faltanteSueldo > 0 ? formatCurrency(flow.faltanteSueldo) : '---'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button onClick={() => setViewingDetails(flow)} className="btn-icon" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary)', padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                        <FileText size={16} />
                      </button>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                        <button onClick={() => handleOpenEdit(flow)} className="btn-icon" style={{ color: 'var(--accent-primary)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => deleteFlow(flow.id)} className="btn-icon" style={{ color: 'var(--error)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL: CIERRE DE MES DETALLADO Y EDICIÓN */}
      {showCloseMonth && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '95%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {editingId ? <Edit2 size={24} color="var(--accent-primary)" /> : <Save size={24} color="var(--accent-primary)" />}
                {editingId ? 'Editar Cierre de Mes' : 'Registro de Cierre Operativo'}
              </h2>
              <button 
                onClick={() => { 
                  setShowCloseMonth(false); 
                  setEditingId(null); 
                  setItemsIngresos(getDefaultTerminals()); 
                  setItemsFijos([
                    { concept: 'Renta Local', amount: '', paidBy: 'Clínica (Fondo)' },
                    { concept: 'Sueldos fijos (Nómina)', amount: '', paidBy: 'Clínica (Fondo)' },
                    { concept: 'Luz y Agua', amount: '', paidBy: 'Clínica (Fondo)' },
                    { concept: 'Teléfono / Internet', amount: '', paidBy: 'Clínica (Fondo)' },
                    { concept: 'Software de Gestión', amount: '', paidBy: 'Clínica (Fondo)' }
                  ]);
                  setItemsVariables([
                    { concept: 'Insumos Médicos', amount: '', paidBy: 'Clínica (Fondo)' },
                    { concept: 'Mantenimiento / Reparaciones', amount: '', paidBy: 'Clínica (Fondo)' },
                    { concept: 'Marketing / Publicidad', amount: '', paidBy: 'Clínica (Fondo)' }
                  ]);
                }} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={24}/>
              </button>
            </div>

            <form onSubmit={handleCreateMonth}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginBottom: '2rem' }}>
                <div className="form-group" style={{ maxWidth: '300px' }}>
                  <label>Mes de Operación</label>
                  <input type="month" value={formMes} onChange={e => setFormMes(e.target.value)} required disabled={!!editingId} />
                </div>
              </div>

              {/* Ingresos Section */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                   <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--success)', letterSpacing: '0.05em' }}>Cobros por Terminal/Socio (Ingresos)</h4>
                   <button type="button" onClick={() => handleAddItem('ingreso')} className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}><Plus size={14}/> + Otra Terminal</button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem', marginTop: '-0.5rem' }}>Indica el monto cobrado en la cuenta de cada socio para calcular correctamente la "Cámara de Compensación". Deja en blanco o $0 lo que no aplique.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '1rem' }}>
                  {itemsIngresos.map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 180px 40px', gap: '1rem', alignItems: 'center' }}>
                      <input 
                        placeholder="Quien recibió el dinero (ej. Terminal Eduardo)" 
                        value={item.concept} 
                        onChange={(e) => handleUpdateItem('ingreso', idx, 'concept', e.target.value)} 
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      />
                      <input 
                        type="number" 
                        placeholder="$ 0.00" 
                        value={item.amount} 
                        onChange={(e) => handleUpdateItem('ingreso', idx, 'amount', e.target.value)}
                        style={{ textAlign: 'right', color: 'var(--success)' }}
                      />
                      <button type="button" onClick={() => handleRemoveItem('ingreso', idx)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}><Trash2 size={16}/></button>
                    </div>
                  ))}
                  <div style={{ textAlign: 'right', paddingRight: '3.5rem', marginTop: '0.5rem', fontWeight: 800, color: 'var(--success)' }}>
                    Total Ventas: {formatCurrency(totals.ingresos)}
                  </div>
                </div>
              </div>

              {/* Gastos Fijos Section */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                   <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--accent-primary)', letterSpacing: '0.05em' }}>Gastos Fijos y Servicios</h4>
                   <button type="button" onClick={() => handleAddItem('fijo')} className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}><Plus size={14}/> Agregar</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '1rem' }}>
                  {itemsFijos.map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 30px', gap: '0.5rem', alignItems: 'center' }}>
                      <input 
                        placeholder="Concepto (ej. Renta, Nómina...)" 
                        value={item.concept} 
                        onChange={(e) => handleUpdateItem('fijo', idx, 'concept', e.target.value)} 
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      />
                      <input 
                        type="number" 
                        placeholder="$ 0.00" 
                        value={item.amount} 
                        onChange={(e) => handleUpdateItem('fijo', idx, 'amount', e.target.value)}
                        style={{ textAlign: 'right' }}
                      />
                      <select 
                        value={item.paidBy || 'Clínica (Fondo)'}
                        onChange={(e) => handleUpdateItem('fijo', idx, 'paidBy', e.target.value)}
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >
                        {payerOptions.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <button type="button" onClick={() => handleRemoveItem('fijo', idx)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gastos Variables Section */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                   <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--accent-secondary)', letterSpacing: '0.05em' }}>Insumos y Gastos Variables</h4>
                   <button type="button" onClick={() => handleAddItem('variable')} className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}><Plus size={14}/> Agregar</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '1rem' }}>
                  {itemsVariables.map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 180px 40px', gap: '1rem', alignItems: 'center' }}>
                      <input 
                        placeholder="Concepto (ej. Insumos Médicos...)" 
                        value={item.concept} 
                        onChange={(e) => handleUpdateItem('variable', idx, 'concept', e.target.value)}
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      />
                      <input 
                        type="number" 
                        placeholder="$ 0.00" 
                        value={item.amount} 
                        onChange={(e) => handleUpdateItem('variable', idx, 'amount', e.target.value)}
                        style={{ textAlign: 'right' }}
                      />
                      <button type="button" onClick={() => handleRemoveItem('variable', idx)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '2rem' }}>
                <label>Sueldo Garantizado Doctor</label>
                <input type="number" value={formSueldoDoctor} onChange={e => setFormSueldoDoctor(e.target.value)} required />
              </div>

              {/* Summary Dashboard Footer inside Modal */}
              <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '1.5rem', border: '1px solid var(--glass-border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '1.5rem', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Egresos</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--error)' }}>- {formatCurrency(totals.total)}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Utilidad Neta</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: totals.utilidad >= 0 ? 'var(--success)' : 'var(--error)' }}>
                    {formatCurrency(totals.utilidad)}
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ height: '56px', width: '100%', fontSize: '1.1rem' }} disabled={isClosingMonth}>
                  {isClosingMonth ? <Loader2 className="animate-spin" /> : 'Confirmar Cierre de Mes'}
                </button>
              </div>
              {error && <p style={{ color: 'var(--error)', marginTop: '1rem', textAlign: 'center', fontSize: '0.875rem' }}>{error}</p>}
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VER DETALLE DE MES CERRADO */}
      {viewingDetails && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                  <h2 style={{ textTransform: 'capitalize' }}>{format(parseISO(viewingDetails.mes + '-01'), 'MMMM yyyy', { locale: es })}</h2>
                  <span className="status-badge" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary)', marginTop: '0.5rem', display: 'inline-block' }}>{viewingDetails.fase}</span>
                </div>
                <button onClick={() => setViewingDetails(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24}/></button>
             </div>

             <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                   <span style={{ fontWeight: 600 }}>Ventas Totales:</span>
                   <span style={{ color: 'var(--success)', fontWeight: 800 }}>{formatCurrency(viewingDetails.ingresos)}</span>
                </div>
                
                {viewingDetails.itemsIngresos && viewingDetails.itemsIngresos.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Desglose de Cobros (Terminales)</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', opacity: 0.8 }}>
                        {viewingDetails.itemsIngresos.map((item, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                            <span>{item.concept}</span>
                            <span style={{ fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div>
                   <h4 style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Desglose de Gastos Fijos</h4>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(viewingDetails.itemsFijos || []).map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                           <span style={{flex: 1}}>{item.concept} {item.paidBy && item.paidBy !== 'Clínica (Fondo)' && <span style={{fontSize: '0.65rem', background:'rgba(255,255,255,0.1)', padding:'2px 6px', borderRadius:'10px', marginLeft:'6px'}}>{item.paidBy}</span>}</span>
                           <span style={{ fontWeight: 600 }}>{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                      {(!viewingDetails.itemsFijos || viewingDetails.itemsFijos.length === 0) && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', opacity: 0.6 }}>
                           <span>Total Fijos (Consolidado)</span>
                           <span style={{ fontWeight: 600 }}>{formatCurrency(viewingDetails.gastosFijos)}</span>
                        </div>
                      )}
                   </div>
                </div>

                <div>
                   <h4 style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Desglose de Gastos Variables</h4>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(viewingDetails.itemsVariables || []).map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                           <span style={{flex: 1}}>{item.concept} {item.paidBy && item.paidBy !== 'Clínica (Fondo)' && <span style={{fontSize: '0.65rem', background:'rgba(255,255,255,0.1)', padding:'2px 6px', borderRadius:'10px', marginLeft:'6px'}}>{item.paidBy}</span>}</span>
                           <span style={{ fontWeight: 600 }}>{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                      {(!viewingDetails.itemsVariables || viewingDetails.itemsVariables.length === 0) && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', opacity: 0.6 }}>
                           <span>Total Variables (Consolidado)</span>
                           <span style={{ fontWeight: 600 }}>{formatCurrency(viewingDetails.gastosVariables)}</span>
                        </div>
                      )}
                   </div>
                </div>

                <div style={{ marginTop: '1rem', padding: '1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid var(--glass-border)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem' }}>Sueldo Doctor Eduardo:</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(viewingDetails.sueldoDoctor)}</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid var(--glass-border)', fontSize: '1.1rem' }}>
                      <span style={{ fontWeight: 800 }}>Utilidad Neta:</span>
                      <span style={{ fontWeight: 800, color: viewingDetails.utilidad >= 0 ? 'var(--success)' : 'var(--error)' }}>{formatCurrency(viewingDetails.utilidad)}</span>
                   </div>
                </div>
             </div>

             <button className="btn btn-secondary" onClick={() => setViewingDetails(null)} style={{ width: '100%', marginTop: '1.5rem' }}>Cerrar Detalle</button>
          </div>
        </div>
      )}

      {/* REGLAS MODAL */}
      {showConfig && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
               <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><Briefcase size={20} color="var(--accent-primary)"/> Configuración de Repartos</h3>
               <button onClick={() => setShowConfig(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20}/></button>
             </div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ padding: '1.25rem', background: 'rgba(99,102,241,0.05)', borderRadius: '1rem', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: '0.75rem' }}>Fase de Recuperación</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 700 }}>
                    <span>Inv: {settings?.rules?.recovery?.investor || 85}%</span>
                    <span>Dr: {settings?.rules?.recovery?.doctor || 15}%</span>
                  </div>
                </div>
                <div style={{ padding: '1.25rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '1rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                   <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--success)', marginBottom: '0.75rem' }}>Fase de Utilidad</h4>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 700 }}>
                    <span>Inv: {settings?.rules?.profit?.investor || 66.6}%</span>
                    <span>Dr: {settings?.rules?.profit?.doctor || 33.3}%</span>
                   </div>
                </div>
                <p style={{ fontSize: '0.75rem', opacity: 0.6, fontStyle: 'italic' }}>* Los porcentajes se aplican automáticamente según el capital pendiente por recuperar.</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashFlow;
