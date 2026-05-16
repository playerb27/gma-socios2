import React, { useState } from 'react';
import { supabase } from '../supabase';
import { 
  Plus, 
  Search, 
  User, 
  Mail, 
  Phone, 
  Trash2, 
  X, 
  Combine,
  AlertCircle,
  ExternalLink,
  Loader2,
  CheckCircle2,
  UserPlus
} from 'lucide-react';
import { useGmaData } from '../hooks/useGmaData';
import { formatCurrency, normalizeSocioName } from '../utils/dataHelpers';

const Partners = () => {
  const { socios, loading, partnerSummaries } = useGmaData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [merging, setMerging] = useState(false);

  const [form, setForm] = useState({
    nombre: '',
    email: '',
    telefono: '',
    notas: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await supabase.from('socios').insert({
        ...form,
        created_at: new Date().toISOString()
      });
      setIsModalOpen(false);
      setForm({ nombre: '', email: '', telefono: '', notas: '' });
    } catch (error) {
      alert('Error al guardar socio');
    }
  };

  const deleteSocio = async (id) => {
    if (window.confirm('¿Eliminar este socio? Nota: Esto no borrará sus inversiones o retornos.')) {
      await supabase.from('socios').delete().eq('id', id);
    }
  };

  /**
   * CRITICAL LOGIC: Merge Duplicate Records
   * Used when data from spreadsheets has variations of the same name.
   */
  const handleMerge = async (partnerName) => {
    const canonicalName = partnerName;
    if (!window.confirm(`¿Deseas normalizar todos los registros existentes a "${canonicalName}"?`)) return;
    setMerging(true);
    try {
      let count = 0;
      // Update records
      const { data: records } = await supabase.from('records').select('id, socio, nombre_inversionista');
      for (const d of (records || [])) {
        const dName = d.socio || d.nombre_inversionista || '';
        if (normalizeSocioName(dName) === canonicalName && dName !== canonicalName) {
          await supabase.from('records').update({ socio: canonicalName, nombre_inversionista: canonicalName }).eq('id', d.id);
          count++;
        }
      }
      // Update returns
      const { data: returns } = await supabase.from('returns').select('id, socio, nombre_inversionista');
      for (const d of (returns || [])) {
        const dName = d.socio || d.nombre_inversionista || '';
        if (normalizeSocioName(dName) === canonicalName && dName !== canonicalName) {
          await supabase.from('returns').update({ socio: canonicalName, nombre_inversionista: canonicalName }).eq('id', d.id);
          count++;
        }
      }
      alert(`Sincronización completa. Se actualizaron ${count} registros.`);
    } catch (err) {
      console.error(err);
      alert('Error durante la fusión de datos.');
    } finally {
      setMerging(false);
    }
  };

  const filteredPartners = partnerSummaries.filter(p => 
    p.nombre.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        <Loader2 className="animate-spin" size={48} />
        <p style={{ marginTop: '1rem' }}>Sincronizando catálogo de socios...</p>
      </div>
    );
  }

  return (
    <div className="partners-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Directorio de Socios</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Gestión de identidades y resúmenes individuales.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <UserPlus size={18} /> Nuevo Socio
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: '2rem' }}>
        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        <input 
          type="text" 
          placeholder="Buscar por nombre..." 
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ paddingLeft: '2.5rem', width: '400px', maxWidth: '100%' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {filteredPartners.map((partner) => (
          <div key={partner.id} className="card" style={{ borderLeft: partner.isTemp ? '4px dashed var(--warning)' : '4px solid var(--accent-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '1rem', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User color="var(--accent-primary)" size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{partner.nombre}</h3>
                  {partner.isTemp && <span style={{ fontSize: '0.65rem', color: 'var(--warning)', fontWeight: 600 }}>NO REGISTRADO EN CATÁLOGO</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button 
                   onClick={() => handleMerge(partner.nombre)} 
                   className="btn btn-secondary" 
                   style={{ padding: '0.5rem', border: 'none' }}
                   disabled={merging}
                   title="Normalizar registros con este nombre"
                >
                  <Combine size={18} color="var(--success)" />
                </button>
                {!partner.isTemp && (
                  <button onClick={() => deleteSocio(partner.id)} className="btn btn-secondary" style={{ padding: '0.5rem', border: 'none', color: 'var(--error)' }}>
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                 <span style={{ opacity: 0.6 }}>Total Invertido:</span>
                 <span style={{ fontWeight: 700 }}>{formatCurrency(partner.totalInvested)}</span>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                 <span style={{ opacity: 0.6 }}>Total Retornado:</span>
                 <span style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(partner.totalReturned)}</span>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderTop: '1px solid var(--glass-border)', paddingTop: '0.5rem' }}>
                 <span style={{ fontWeight: 600 }}>Saldo Actual:</span>
                 <span style={{ fontWeight: 800, color: partner.totalInvested - partner.totalReturned > 0 ? 'var(--warning)' : 'var(--success)' }}>
                   {formatCurrency(Math.max(0, partner.totalInvested - partner.totalReturned))}
                 </span>
               </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', opacity: 0.6 }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><AlertCircle size={14} /> {partner.countInv} Inversiones</div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle2 size={14} /> {partner.countRet} Pagos</div>
            </div>
          </div>
        ))}

        {filteredPartners.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem', opacity: 0.5 }}>
             No se encontraron socios con ese nombre.
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2>Nuevo Socio Inversionista</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)' }}><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre Completo</label>
                <input type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} placeholder="Ej. Juan Pérez" required />
              </div>
              <div className="form-group">
                <label>Correo Electrónico</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="correo@ejemplo.com" style={{ paddingLeft: '2.2rem' }} />
                </div>
              </div>
              <div className="form-group">
                <label>Teléfono</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                  <input type="tel" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} placeholder="+52 ..." style={{ paddingLeft: '2.2rem' }} />
                </div>
              </div>
              <div className="form-group">
                <label>Notas Privadas</label>
                <textarea value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} placeholder="Información adicional del socio..." rows="3" />
              </div>
              
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                Registrar Socio
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Partners;
