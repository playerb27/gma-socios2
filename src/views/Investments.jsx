import React, { useState, useRef } from 'react';
import { supabase } from '../supabase';
import { uploadFile } from '../utils/storage';
import FileButton from '../components/FileButton';
import { 
  Plus, Search, FileText, Trash2, Upload, X,
  DollarSign, Briefcase, Calendar, Edit2, History, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseSafeDate } from '../utils/dateFormatter';
import { useGmaData } from '../hooks/useGmaData';
import { formatCurrency, normalizeSocioName } from '../utils/dataHelpers';

const Investments = () => {
  const { inversiones, socios, loading, stats } = useGmaData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [editId, setEditId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState('');
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    socioId: '', cantidad: '', tipo: 'dinero',
    fecha: format(new Date(), 'yyyy-MM-dd'), descripcion: '', comprobantes: []
  });

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const newComprobantes = [];
      for (const file of files) {
        const folder = file.type.includes('pdf') ? 'documents' : 'records';
        const path = await uploadFile(file, folder); // stores private path, not public URL
        newComprobantes.push({ url: path, name: file.name });
      }
      setForm(prev => ({ ...prev, comprobantes: [...prev.comprobantes, ...newComprobantes] }));
    } catch (error) {
      alert(`Error al subir el archivo: ${error.message || 'Desconocido'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (inv) => {
    setEditId(inv.id);
    setForm({
      socioId: inv.socio_id || socios.find(s => normalizeSocioName(s.nombre) === inv.nombreInversionista)?.id || '',
      cantidad: inv.cantidad,
      tipo: inv.tipo?.toLowerCase() === 'capital' || inv.tipo === 'dinero' ? 'dinero' : 'bienes',
      fecha: format(parseSafeDate(inv.fecha), 'yyyy-MM-dd'),
      descripcion: inv.descripcion,
      comprobantes: inv.fileUrls?.map(url => ({ url, name: 'Archivo Adjunto' })) || []
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.socioId) return alert('Selecciona un socio');
    try {
      const socio = socios.find(s => s.id === form.socioId);
      const payload = {
        cantidad: Number(form.cantidad || 0),
        valor: String(form.cantidad || 0),
        socio: socio.nombre,
        tipo: form.tipo === 'dinero' ? 'Capital' : 'Especie',
        fecha: new Date(form.fecha).toISOString(),
        descripcion: form.descripcion,
        file_urls: form.comprobantes.map(c => c.url),
        num_archivos: form.comprobantes.length,
        socio_id: form.socioId,
        updated_at: new Date().toISOString()
      };
      if (editId) {
        const currentInv = inversiones.find(inv => inv.id === editId);
        const newHistory = [...(currentInv.history || []), {
          date: new Date().toISOString(),
          previousData: { valor: currentInv.cantidad, descripcion: currentInv.descripcion, fecha: currentInv.fecha, tipo: currentInv.tipo },
          action: 'Edición'
        }];
        await supabase.from('records').update({ ...payload, history: newHistory }).eq('id', editId);
      } else {
        await supabase.from('records').insert({ ...payload, created_at: new Date().toISOString(), moneda: 'MXN', history: [] });
      }
      handleCloseModal();
    } catch (error) {
      alert('Error al registrar la inversión');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Eliminar este registro de inversión?')) {
      await supabase.from('records').delete().eq('id', id);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false); setEditId(null);
    setForm({ socioId: '', cantidad: '', tipo: 'dinero', fecha: format(new Date(), 'yyyy-MM-dd'), descripcion: '', comprobantes: [] });
  };

  const filteredInversiones = inversiones.filter(inv =>
    `${inv.nombreInversionista || ''} ${inv.descripcion || ''}`.toLowerCase().includes(String(filter || '').toLowerCase())
  );

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
      <Loader2 className="animate-spin" size={48} />
      <p style={{ marginTop: '1rem' }}>Cargando registros de inversiones...</p>
    </div>
  );

  return (
    <div className="investments-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input type="text" placeholder="Buscar inversión o socio..." value={filter} onChange={(e) => setFilter(e.target.value)} style={{ paddingLeft: '2.5rem', width: '350px' }} />
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}><Plus size={18} /> Registrar Inversión</button>
      </div>

      <div style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(99,102,241,0.05)', borderRadius: '1rem', display: 'flex', gap: '2rem' }}>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Invertido</span>
          <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{formatCurrency(stats.totalInvested)}</div>
        </div>
        <div style={{ height: '30px', width: '1px', background: 'var(--glass-border)' }} />
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Registros</span>
          <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{filteredInversiones.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {filteredInversiones.map((inv) => (
          <div key={inv.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={14} />{inv.fechaObj ? format(inv.fechaObj, 'PPP', { locale: es }) : '---'}
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {inv.history?.length > 0 && (
                  <button className="btn btn-secondary" style={{ padding: '0.4rem', border: 'none' }} onClick={() => { setHistoryItems(inv.history); setIsHistoryModalOpen(true); }}><History size={16} /></button>
                )}
                <button className="btn btn-secondary" style={{ padding: '0.4rem', border: 'none' }} onClick={() => handleEdit(inv)}><Edit2 size={16} /></button>
                <button className="btn btn-secondary" style={{ padding: '0.4rem', border: 'none', color: 'var(--error)' }} onClick={() => handleDelete(inv.id)}><Trash2 size={16} /></button>
              </div>
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.5rem 0' }}>{formatCurrency(inv.cantidad)}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: inv.tipo === 'dinero' ? 'var(--success)' : 'var(--warning)' }} />
                {inv.nombreInversionista}
              </div>
            </div>
            <div style={{ fontSize: '0.875rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>
              <strong>Concepto:</strong> {inv.descripcion || 'Sin descripción'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
              <span className={`status-badge status-${inv.tipo?.toLowerCase() === 'capital' || inv.tipo === 'dinero' ? 'dinero' : 'bienes'}`}>
                {inv.tipo === 'dinero' ? 'Efectivo' : (inv.tipo || 'Capital')}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {inv.fileUrls?.map((pathOrUrl, i) => (
                  <FileButton key={i} pathOrUrl={pathOrUrl} index={i} />
                ))}
              </div>
            </div>
          </div>
        ))}
        {filteredInversiones.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem', color: 'var(--text-secondary)' }}>No hay registros de inversiones.</div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2>{editId ? 'Editar Inversión' : 'Registrar Inversión'}</h2>
              <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Socio Inversionista</label>
                <select value={form.socioId} onChange={(e) => setForm({ ...form, socioId: e.target.value })} required>
                  <option value="">Seleccione un socio...</option>
                  {socios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Cantidad</label>
                  <div style={{ position: 'relative' }}>
                    <DollarSign size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-primary)' }} />
                    <input type="number" step="0.01" min="0" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} placeholder="0.00" style={{ paddingLeft: '2.5rem' }} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Fecha</label>
                  <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label>Tipo</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="button" className={`btn ${form.tipo === 'dinero' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setForm({ ...form, tipo: 'dinero' })}><DollarSign size={18} /> Dinero</button>
                  <button type="button" className={`btn ${form.tipo === 'bienes' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setForm({ ...form, tipo: 'bienes' })}><Briefcase size={18} /> Bienes</button>
                </div>
              </div>
              <div className="form-group">
                <label>Concepto</label>
                <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows="2" />
              </div>
              <div className="form-group">
                <label>Comprobante</label>
                <div onClick={() => fileInputRef.current.click()} style={{ border: '2px dashed var(--glass-border)', borderRadius: '1rem', padding: '1.5rem', textAlign: 'center', cursor: 'pointer' }}>
                  <input type="file" ref={fileInputRef} hidden multiple onChange={handleFileChange} accept="image/*,application/pdf" />
                  {uploading ? (
                    <div style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><Loader2 className="animate-spin" size={18} /> Subiendo...</div>
                  ) : (
                    <div style={{ color: 'var(--text-secondary)' }}><Upload size={24} /><p style={{ fontSize: '0.875rem' }}>Clic para subir archivos</p></div>
                  )}
                  {form.comprobantes.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                      {form.comprobantes.map((c, i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.1)', padding: '0.4rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <FileText size={14} color="var(--success)" />
                          <span>{c.name}</span>
                          <button type="button" onClick={() => setForm(prev => ({ ...prev, comprobantes: prev.comprobantes.filter((_, idx) => idx !== i) }))} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--error)' }}><X size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={uploading}>{editId ? 'Guardar Cambios' : 'Registrar Inversión'}</button>
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal} style={{ flex: 1 }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isHistoryModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><History size={20} color="var(--accent-primary)" /><h2 style={{ fontSize: '1.25rem' }}>Historial</h2></div>
              <button onClick={() => setIsHistoryModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {historyItems.length > 0 ? [...historyItems].reverse().map((item, idx) => (
                <div key={idx} style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', borderLeft: '3px solid var(--accent-primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>{format(parseSafeDate(item.date), 'dd/MM/yyyy HH:mm')}</span>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{item.action}</span>
                  </div>
                  <ul style={{ listStyle: 'none', paddingLeft: '0.5rem', color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                    <li>Monto: {formatCurrency(item.previousData?.valor)}</li>
                    <li style={{ fontStyle: 'italic' }}>"{item.previousData?.descripcion || 'Sin descripción'}"</li>
                  </ul>
                </div>
              )) : <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>Sin historial.</p>}
            </div>
            <button className="btn btn-secondary" onClick={() => setIsHistoryModalOpen(false)} style={{ width: '100%', marginTop: '1.5rem' }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Investments;
