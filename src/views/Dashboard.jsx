import React, { useMemo, useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight,
  PieChart as PieChartIcon,
  Activity,
  Calendar,
  CreditCard,
  Loader2,
  CheckCircle2,
  Search,
  Filter,
  FileText,
  History,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Plus,
  X,
  Upload,
  Briefcase
} from 'lucide-react';
import { supabase } from '../supabase';
import { uploadFile } from '../utils/storage';
import FileButton from '../components/FileButton';
import { parseSafeDate } from '../utils/dateFormatter';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useGmaData } from '../hooks/useGmaData';
import { formatCurrency, formatNumber, normalizeSocioName } from '../utils/dataHelpers';
import { useRef } from 'react';

const Dashboard = () => {
  const { cashflow, inversiones, socios, retornos, settings, loading, stats, partnerSummaries } = useGmaData();
  const [filter, setFilter] = useState('');
  
  const handleExportData = () => {
    const backup = {
      socios,
      records: inversiones,
      returns: retornos,
      cashflow,
      settings
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "gma-backup-supabase.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    alert("¡Datos exportados con éxito! Ahora guárdalos para subirlos a Supabase.");
  };

  // -- Edit/Delete Logic --
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    socioId: '',
    cantidad: '',
    tipo: 'dinero',
    fecha: format(new Date(), 'yyyy-MM-dd'),
    descripcion: '',
    comprobantes: []
  });

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const newComprobantes = [];
      for (const file of files) {
        const folder = file.type.includes('pdf') ? 'documents' : 'records';
        const path = await uploadFile(file, folder);
        newComprobantes.push({ url: path, name: file.name });
      }
      setForm(prev => ({ ...prev, comprobantes: [...prev.comprobantes, ...newComprobantes] }));
    } catch (error) {
      console.error('Error uploading file:', error);
      alert(`Error al subir el archivo: ${error.message || 'Desconocido'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (inv) => {
    setEditId(inv.id);
    const foundSocio = socios.find(s => normalizeSocioName(s.nombre) === inv.nombreInversionista);
    setForm({
      socioId: inv.socioId || foundSocio?.id || '',
      cantidad: inv.cantidad,
      tipo: inv.tipo?.toLowerCase() === 'capital' || inv.tipo === 'dinero' ? 'dinero' : 'bienes',
      fecha: format(parseSafeDate(inv.fecha), 'yyyy-MM-dd'),
      descripcion: inv.descripcion,
      comprobantes: inv.fileUrls?.map(url => ({ url, name: 'Archivo Adjunto' })) || []
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Eliminar este registro de inversión?')) {
      try {
        await supabase.from('records').delete().eq('id', id);
      } catch (error) {
        console.error('Error deleting investment:', error);
        alert('Error al eliminar el registro');
      }
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditId(null);
    setForm({
      socioId: '',
      cantidad: '',
      tipo: 'dinero',
      fecha: format(new Date(), 'yyyy-MM-dd'),
      descripcion: '',
      comprobantes: []
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.socioId) return alert("Selecciona un socio");

    try {
      const socio = socios.find(s => s.id === form.socioId);
      const investmentDate = new Date(form.fecha);
      
      const payload = {
        cantidad: Number(form.cantidad || 0),
        valor: String(form.cantidad || 0),
        socio: socio.nombre,
        tipo: form.tipo === 'dinero' ? 'Capital' : 'Especie',
        fecha: investmentDate.toISOString(),
        descripcion: form.descripcion,
        fileUrls: form.comprobantes.map(c => c.url),
        numArchivos: form.comprobantes.length,
        socioId: form.socioId,
        updatedAt: new Date().toISOString()
      };

      if (editId) {
        const currentInv = inversiones.find(inv => inv.id === editId);
        const newHistory = [...(currentInv.history || []), {
          date: new Date().toISOString(),
          previousData: { valor: currentInv.cantidad, descripcion: currentInv.descripcion, fecha: currentInv.fecha, tipo: currentInv.tipo },
          action: 'Edición (desde Panel)'
        }];
        await supabase.from('records').update({ ...payload, history: newHistory }).eq('id', editId);
      }

      handleCloseModal();
    } catch (error) {
      console.error("Error saving investment:", error);
      alert("Error al guardar los cambios");
    }
  };

  // -- Data Filtering for the Investments Table --
  const filteredInversiones = useMemo(() => {
    if (!inversiones) return [];
    return inversiones.filter(inv => {
      const search = filter.toLowerCase();
      return (
        inv.nombreInversionista?.toLowerCase().includes(search) ||
        inv.descripcion?.toLowerCase().includes(search) ||
        inv.tipo?.toLowerCase().includes(search)
      );
    });
  }, [inversiones, filter]);

  // -- Chart Data --
  const timelineData = useMemo(() => {
    if (!cashflow || cashflow.length === 0) return [];
    return [...cashflow]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .slice(-6)
      .map(flow => ({
        mes: format(parseISO(flow.mes + '-01'), 'MMM yy', { locale: es }).toUpperCase(),
        utilidad: Number(flow.utilidad || 0),
        ingresos: Number(flow.ingresos || 0)
      }));
  }, [cashflow]);

  const partnersPieData = useMemo(() => {
    return partnerSummaries
      .filter(p => p.totalInvested > 0)
      .map(p => ({
        name: p.nombre,
        value: p.totalInvested
      }));
  }, [partnerSummaries]);

  const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        <Loader2 className="animate-spin" size={48} />
        <p style={{ marginTop: '1rem' }}>Cargando Panel de Control...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Primary Stats */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button 
          onClick={handleExportData} 
          className="btn btn-secondary" 
          style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
        >
          <Upload size={18} />
          Exportar Datos para Supabase
        </button>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <span className="card-title">Inversión Total</span>
              <div className="card-value">{formatCurrency(stats.totalInvested)}</div>
            </div>
            <div style={{ p: '0.75rem', background: 'rgba(99,102,241,0.1)', borderRadius: '1rem' }}>
              <DollarSign size={24} color="var(--accent-primary)" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--success)' }}>
            <Activity size={14} /> <span>Capital Activo</span>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <span className="card-title">Retorno Acumulado</span>
              <div className="card-value">{formatCurrency(stats.totalReturned)}</div>
            </div>
            <div style={{ p: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '1rem' }}>
              <TrendingUp size={24} color="var(--success)" />
            </div>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
              <span>Recuperación</span>
              <span>{stats.recoveryProgress.toFixed(1)}%</span>
            </div>
            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${stats.recoveryProgress}%`, height: '100%', background: 'var(--success)' }} />
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <span className="card-title">Socios Activos</span>
              <div className="card-value">{socios.length}</div>
            </div>
            <div style={{ p: '0.75rem', background: 'rgba(168, 85, 247, 0.1)', borderRadius: '1rem' }}>
              <Users size={24} color="var(--accent-secondary)" />
            </div>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Registrados en el sistema</div>
        </div>
      </div>

      {/* Visual Analysis Section */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', marginTop: '2rem' }}>
        <div className="chart-container">
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><Activity size={20} color="var(--accent-primary)" /> Utilidad Mensual</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="colorUtil" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="mes" stroke="var(--text-secondary)" fontSize={12} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} tickFormatter={(val) => `$${val/1000}k`} />
                <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '0.75rem' }} formatter={(val) => formatCurrency(val)} />
                <Area type="monotone" dataKey="utilidad" stroke="var(--accent-primary)" fillOpacity={1} fill="url(#colorUtil)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-container">
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><PieChartIcon size={20} color="var(--accent-secondary)" /> Reparto de Equity</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={partnersPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                  {partnersPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: '0.75rem' }} formatter={(val) => formatCurrency(val)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* RESTORED: PANEL DE INVERSIONES REALIZADAS CON FILTROS */}
      <div className="card" style={{ marginTop: '2rem', padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
           <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
             <History size={20} color="var(--accent-primary)" /> Inversiones Realizadas
           </h3>
           <div style={{ position: 'relative', width: '300px' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
              <input 
                type="text" 
                placeholder="Filtrar por socio o concepto..." 
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{ paddingLeft: '2.5rem', fontSize: '0.875rem' }}
              />
           </div>
        </div>
        
        <div className="table-container" style={{ marginTop: 0, border: 'none', borderRadius: 0, maxHeight: '500px', overflow: 'auto' }}>
          <table>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-secondary)' }}>
              <tr>
                <th>Fecha</th>
                <th>Socio</th>
                <th style={{ textAlign: 'right' }}>Monto</th>
                <th>Tipo</th>
                <th>Concepto</th>
                <th style={{ textAlign: 'center' }}>Docs</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredInversiones.map((inv, idx) => (
                <tr key={inv.id || idx}>
                  <td style={{ fontSize: '0.875rem' }}>{inv.fecha ? format(parseISO(inv.fecha), 'dd MMM yyyy', { locale: es }) : '---'}</td>
                  <td style={{ fontWeight: 600 }}>{inv.nombreInversionista}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-primary)' }}>{formatCurrency(inv.cantidad)}</td>
                  <td>
                    <span className={`status-badge status-${inv.tipo?.toLowerCase() === 'capital' || inv.tipo === 'dinero' ? 'dinero' : 'bienes'}`}>
                      {inv.tipo === 'dinero' || inv.tipo === 'Capital' ? 'EFECTIVO' : 'BIENES'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem', opacity: 0.8, maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {inv.descripcion || '---'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                      {inv.fileUrls && inv.fileUrls.length > 0 ? (
                        inv.fileUrls.map((url, i) => (
                          <button 
                            key={i} 
                            onClick={() => window.open(url, '_blank')} 
                            style={{ padding: '4px', background: 'rgba(99,102,241,0.1)', border: 'none', borderRadius: '4px', color: 'var(--accent-primary)', cursor: 'pointer' }}
                            title={`Ver documento ${i+1}`}
                          >
                            <FileText size={16} />
                          </button>
                        ))
                      ) : (
                        <span style={{ opacity: 0.2 }}><FileText size={16} /></span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button 
                        onClick={() => handleEdit(inv)} 
                        style={{ padding: '4px', background: 'rgba(168, 85, 247, 0.1)', border: 'none', borderRadius: '4px', color: 'var(--accent-secondary)', cursor: 'pointer' }}
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(inv.id)} 
                        style={{ padding: '4px', background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '4px', color: 'var(--error)', cursor: 'pointer' }}
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInversiones.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '4rem', opacity: 0.5 }}>No se encontraron registros coincidentes.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '1rem 1.5rem', background: 'rgba(255,255,255,0.02)', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'right', borderTop: '1px solid var(--glass-border)' }}>
          Mostrando {filteredInversiones.length} de {inversiones.length} inversiones totales.
        </div>
      </div>

      {/* Edit Modal (Restored) */}
      {isModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Editar Inversión</h2>
              <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Socio Inversionista</label>
                <select 
                  value={form.socioId} 
                  onChange={(e) => setForm({ ...form, socioId: e.target.value })}
                  required
                >
                  <option value="">Seleccione un socio...</option>
                  {socios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Monto</label>
                  <div style={{ position: 'relative' }}>
                    <DollarSign size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-primary)' }} />
                    <input 
                      type="number"
                      step="0.01"
                      value={form.cantidad}
                      onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                      required={form.tipo === 'dinero'}
                      style={{ paddingLeft: '2.5rem' }}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Fecha</label>
                  <input 
                    type="date" 
                    value={form.fecha}
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Tipo de Inversión</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    type="button"
                    className={`btn ${form.tipo === 'dinero' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => setForm({ ...form, tipo: 'dinero' })}
                  >
                    <DollarSign size={18} /> Dinero
                  </button>
                  <button 
                    type="button"
                    className={`btn ${form.tipo === 'bienes' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => setForm({ ...form, tipo: 'bienes' })}
                  >
                    <Briefcase size={18} /> Bienes
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Concepto</label>
                <textarea 
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  rows="2"
                />
              </div>

              <div className="form-group">
                <label>Comprobante (Imagen/PDF)</label>
                <div 
                  onClick={() => fileInputRef.current.click()}
                  style={{ 
                    border: '2px dashed var(--glass-border)', 
                    borderRadius: '1rem', 
                    padding: '1.5rem', 
                    textAlign: 'center', 
                    cursor: 'pointer',
                    background: form.comprobantes?.length > 0 ? 'rgba(16, 185, 129, 0.05)' : 'transparent'
                  }}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    hidden 
                    multiple
                    onChange={handleFileChange}
                    accept="image/*,application/pdf"
                  />
                  {uploading ? (
                    <div style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <Loader2 className="animate-spin" size={18} />
                      Subiendo archivos...
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Upload size={24} style={{ marginBottom: '0.5rem' }} />
                      <p style={{ fontSize: '0.875rem' }}>Subir o arrastrar comprobantes</p>
                    </div>
                  )}
                  
                  {form.comprobantes.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem', justifyContent: 'center' }}>
                       {form.comprobantes.map((c, i) => (
                          <div key={i} style={{ background: 'rgba(255,255,255,0.1)', padding: '0.4rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                             <FileText size={14} color="var(--success)" /> 
                             <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                          </div>
                       ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={uploading}>
                  Guardar Cambios
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal} style={{ flex: 1 }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
