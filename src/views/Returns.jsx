import React, { useState, useRef } from 'react';
import { supabase } from '../supabase';
import { uploadFile } from '../utils/storage';
import FileButton from '../components/FileButton';
import { 
  Plus, 
  Search, 
  FileText, 
  Image as ImageIcon, 
  Trash2, 
  Upload, 
  X,
  DollarSign,
  Briefcase,
  Calendar,
  User,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useGmaData } from '../hooks/useGmaData';
import { formatCurrency, normalizeSocioName } from '../utils/dataHelpers';

const Returns = () => {
  const { retornos, socios, loading, stats, partnerSummaries } = useGmaData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState('');
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    socioId: '',
    cantidad: '',
    tipo: 'dinero',
    fecha: format(new Date(), 'yyyy-MM-dd'),
    descripcion: '',
    categoria: 'recuperacion', // 'recuperacion' | 'utilidad' | 'sueldo'
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.socioId) return alert("Selecciona un socio");

    try {
      const selectedDate = new Date(form.fecha);
      const selectedSocio = socios.find(s => s.id === form.socioId);

      const returnData = {
        cantidad: Number(form.cantidad),
        fecha: selectedDate.toISOString(),
        socioId: form.socioId,
        nombreInversionista: selectedSocio ? String(selectedSocio.nombre) : 'Desconocido',
        tipo: form.tipo,
        categoria: form.categoria,
        createdAt: new Date().toISOString(),
        fileUrls: form.comprobantes.map(c => c.url),
        numArchivos: form.comprobantes.length,
        descripcion: form.descripcion
      };

      await supabase.from('returns').insert({
        ...returnData,
        file_urls: returnData.fileUrls,
        num_archivos: returnData.numArchivos,
        nombre_inversionista: returnData.nombreInversionista,
        socio_id: returnData.socioId,
        created_at: returnData.createdAt
      });
      handleCloseModal();
    } catch (error) {
      console.error('Error saving retorno:', error);
      alert('Hubo un error al guardar el retorno.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este retorno?')) {
      await supabase.from('returns').delete().eq('id', id);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setForm({
      socioId: '',
      cantidad: '',
      tipo: 'dinero',
      fecha: format(new Date(), 'yyyy-MM-dd'),
      descripcion: '',
      categoria: 'recuperacion',
      comprobantes: []
    });
  };

  const filteredRetornos = retornos.filter(ret => {
    const searchString = `${ret.nombreInversionista || ''} ${ret.descripcion || ''}`.toLowerCase();
    return searchString.includes(String(filter || '').toLowerCase());
  });

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        <Loader2 className="animate-spin" size={48} />
        <p style={{ marginTop: '1rem' }}>Cargando retornos de capital...</p>
      </div>
    );
  }

  return (
    <div className="investments-view">
      {/* Dashboard de Totales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
        {partnerSummaries.length > 0 ? (
          partnerSummaries.map((summary) => (
            <div key={summary.id} className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--accent-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={16} color="var(--accent-primary)" />
                </div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{summary.nombre}</h4>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', opacity: 0.8 }}>
                  <span>Total Invertido:</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(summary.totalInvested)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', opacity: 0.8 }}>
                  <span>Total Retornado:</span>
                  <span style={{ fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(summary.totalReturned)}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                  <span>SALDO RESTANTE:</span>
                  <span style={{ color: summary.totalInvested - summary.totalReturned > 0 ? 'var(--warning)' : 'var(--success)' }}>
                    {formatCurrency(Math.max(0, summary.totalInvested - summary.totalReturned))}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="card" style={{ gridColumn: '1/-1', textAlign: 'center', opacity: 0.5, padding: '2rem' }}>
             No hay retornos registrados para mostrar resúmenes.
          </div>
        )}
      </div>

      {/* Search & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            placeholder="Buscar retorno o socio..." 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ paddingLeft: '2.5rem', width: '350px' }}
          />
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Registrar Retorno
        </button>
      </div>

      {/* Grid of Returns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {filteredRetornos.map((ret) => (
          <div key={ret.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={14} />
                {ret.fechaObj ? format(ret.fechaObj, 'PPP', { locale: es }) : '---'}
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.4rem', border: 'none', color: 'var(--error)' }} onClick={() => handleDelete(ret.id)}>
                <Trash2 size={16} />
              </button>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.5rem 0' }}>
                  {formatCurrency(ret.cantidad)}
                </h3>
                <span className={`status-badge status-${ret.categoria || 'recuperacion'}`} style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>
                  {ret.categoria === 'recuperacion' ? 'Capital' : (ret.categoria === 'utilidad' ? 'Ganancia' : 'Sueldo')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 500 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: ret.categoria === 'utilidad' ? 'var(--success)' : (ret.categoria === 'recuperacion' ? 'var(--accent-primary)' : 'var(--warning)') }} />
                {ret.nombreInversionista}
              </div>
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', margin: '0.25rem 0' }}>
              <strong>Concepto:</strong> {ret.descripcion || 'Sin descripción'}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
              <span className={`status-badge status-${ret.tipo?.toLowerCase() === 'capital' || ret.tipo === 'dinero' ? 'dinero' : 'bienes'}`}>
                {ret.tipo === 'dinero' ? 'Efectivo' : (ret.tipo || 'Capital')}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {ret.fileUrls && ret.fileUrls.map((url, i) => (
                  <button key={i} onClick={() => window.open(url, '_blank')} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}>
                    <ImageIcon size={14} /> Doc {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
        {filteredRetornos.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem', color: 'var(--text-secondary)' }}>
            No hay retornos registrados.
          </div>
        )}
      </div>

      {/* Modal Registry */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2>Registrar Nuevo Retorno a Inversor</h2>
              <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
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
                {socios.length === 0 && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>
                    * Primero debes crear un socio en la sección "Socios"
                  </p>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Cantidad (Monto Total)</label>
                  <div style={{ position: 'relative' }}>
                    <DollarSign size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-primary)' }} />
                    <input 
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.cantidad}
                      onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
                      required
                      placeholder="0.00"
                      style={{ paddingLeft: '2.5rem', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}
                    />
                  </div>
                  {form.cantidad && !isNaN(Number(form.cantidad)) && (
                    <div style={{ marginTop: '0.5rem', color: 'var(--success)', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      ✓ Confirmas: {formatCurrency(form.cantidad)} MXN
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Fecha de Aportación</label>
                  <div style={{ position: 'relative' }}>
                    <Calendar size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-primary)', pointerEvents: 'none' }} />
                    <input 
                      type="date" 
                      value={form.fecha}
                      onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                      required
                      style={{ paddingLeft: '2.8rem', cursor: 'pointer', color: form.fecha ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Formato de Retorno</label>
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
                <label>Descripción / Concepto</label>
                <textarea 
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Periodo de rendimiento, retorno de capital, etc..."
                  rows="2"
                />
              </div>

              <div className="form-group">
                <label>Categoría del Pago</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    type="button"
                    className={`btn ${form.categoria === 'recuperacion' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, fontSize: '0.75rem' }}
                    onClick={() => setForm({ ...form, categoria: 'recuperacion' })}
                  >
                    Recup. Capital
                  </button>
                  <button 
                    type="button"
                    className={`btn ${form.categoria === 'utilidad' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, fontSize: '0.75rem' }}
                    onClick={() => setForm({ ...form, categoria: 'utilidad' })}
                  >
                    Ganancia / Utilidad
                  </button>
                  <button 
                    type="button"
                    className={`btn ${form.categoria === 'sueldo' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, fontSize: '0.75rem' }}
                    onClick={() => setForm({ ...form, categoria: 'sueldo' })}
                  >
                    Sueldo Base
                  </button>
                </div>
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
                    transition: 'all 0.3s ease',
                    background: form.comprobantes?.length > 0 ? 'rgba(16, 185, 129, 0.05)' : 'transparent'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                  onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    hidden 
                    multiple
                    onChange={handleFileChange}
                    accept="image/*,application/pdf"
                  />
                  {uploading && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--accent-primary)', marginBottom: '1rem' }}>
                      <Loader2 className="animate-spin" size={18} />
                      Subiendo archivos...
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Upload size={24} style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)' }} />
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Haz clic para subir o arrastra los archivos aquí
                    </p>
                  </div>

                  {form.comprobantes.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem', width: '100%', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                       {form.comprobantes.map((c, i) => (
                          <div key={i} style={{ background: 'rgba(255,255,255,0.1)', padding: '0.4rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                             <FileText size={14} color="var(--success)" /> 
                             <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                             <button type="button" onClick={() => setForm(prev => ({ ...prev, comprobantes: prev.comprobantes.filter((_, idx) => idx !== i) }))} style={{ background: 'transparent', border: 'none', padding: 0, display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'var(--error)' }}>
                               <X size={14} />
                             </button>
                          </div>
                       ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={uploading}>
                  Registrar Retorno
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

export default Returns;
