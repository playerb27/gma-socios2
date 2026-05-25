import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabase';
import { uploadFile, openFile, isFirebasePath } from '../utils/storage';
import { 
  Plus, 
  Search, 
  FileText, 
  Trash2, 
  Upload, 
  X,
  AlertTriangle,
  Filter,
  Calendar,
  Download,
  FolderOpen,
  Tag,
  ArrowDownAz,
  ArrowUpAz
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { parseSafeDate } from '../utils/dateFormatter';

const Documents = () => {
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState(['Facturas', 'Contratos', 'Identificaciones', 'Otros']);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [sortField, setSortField] = useState('uploadDate');
  const [sortOrder, setSortOrder] = useState('desc');
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    name: '',
    category: '',
    newCategory: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    file: null,
    fileName: ''
  });

  // fetchDocs is a useCallback so it can be called from anywhere (submit, delete, etc.)
  const fetchDocs = useCallback(async () => {
    const { data, error } = await supabase.from('documents').select('*').order('upload_date', { ascending: false });
    if (error) console.error('Error fetching documents:', error);
    setDocuments((data || []).map(d => ({ ...d, uploadDate: d.upload_date, documentDate: d.document_date, fileUrl: d.file_url, fileName: d.file_name, fileType: d.file_type })));
  }, []);

  useEffect(() => {
    fetchDocs();

    // Fetch categories from settings
    const fetchCats = async () => {
      const { data } = await supabase.from('settings').select('*').eq('id', 'documentCategories').single();
      if (data?.list) setCategories(data.list);
      else {
        await supabase.from('settings').upsert({ id: 'documentCategories', list: ['Facturas', 'Contratos', 'Identificaciones', 'Otros'] });
      }
    };
    fetchCats();

    // Realtime — backup for other sessions/devices
    const channel = supabase.channel('realtime:documents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, fetchDocs)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchDocs]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm(prev => ({ 
        ...prev, 
        file, 
        fileName: file.name,
        name: prev.name || file.name.split('.').slice(0, -1).join('.')
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.file) return alert("Por favor selecciona un archivo");
    
    const finalCategory = form.category === 'new' ? form.newCategory : form.category;
    if (!finalCategory) return alert("Por favor selecciona o crea una categoría");

    setUploading(true);
    try {
      if (form.category === 'new') {
        const catExists = categories.some(cat => cat.toLowerCase() === form.newCategory.toLowerCase());
        if (!catExists) {
          const newList = [...categories, form.newCategory];
          await supabase.from('settings').upsert({ id: 'documentCategories', list: newList });
          setCategories(newList);
        }
      }

      // Upload to Supabase Storage and store the path (not a public URL)
      const storagePath = await uploadFile(form.file, 'business_documents');

      await supabase.from('documents').insert({
        name: form.name,
        category: finalCategory,
        upload_date: new Date().toISOString(),
        document_date: new Date(form.date).toISOString(),
        file_url: storagePath,
        file_name: form.file.name,
        file_type: form.file.type,
        size: form.file.size
      });

      // Refresh immediately — don't wait for Realtime
      await fetchDocs();
      handleCloseModal();
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Error al subir el documento');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id, fileUrl) => {
    if (window.confirm('¿Estás seguro de eliminar este documento?')) {
      try {
        const { error } = await supabase.from('documents').delete().eq('id', id);
        if (error) throw error;
        // Refresh immediately
        await fetchDocs();
      } catch (error) {
        console.error('Error deleting document:', error);
        alert('Error al eliminar');
      }
    }
  };

  const deleteCategory = async (catToDelete) => {
    if (window.confirm(`¿Estás seguro de eliminar la categoría "${catToDelete}"?`)) {
      try {
        const newList = categories.filter(c => c !== catToDelete);
        await supabase.from('settings').upsert({ id: 'documentCategories', list: newList });
        setCategories(newList);
        for (const d of documents.filter(doc => doc.category === catToDelete)) {
          await supabase.from('documents').update({ category: 'Sin categoría' }).eq('id', d.id);
        }
      } catch (error) {
        alert('Error al eliminar la categoría');
      }
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setForm({
      name: '',
      category: '',
      newCategory: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      file: null,
      fileName: ''
    });
  };

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const counts = categories.reduce((acc, cat) => {
    acc[cat] = documents.filter(d => d.category === cat).length;
    return acc;
  }, {});
  counts['Todas'] = documents.length;
  counts['Sin categoría'] = documents.filter(d => d.category === 'Sin categoría' || !d.category).length;

  const filteredDocs = documents
    .filter(d => {
      const matchesSearch = d.name.toLowerCase().includes(filter.toLowerCase()) || 
                            d.fileName.toLowerCase().includes(filter.toLowerCase());
      const docCat = d.category || 'Sin categoría';
      const matchesCategory = categoryFilter === 'Todas' || docCat === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      
      if (sortField === 'documentDate' || sortField === 'uploadDate') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <div style={{ opacity: 0.2 }}><ArrowDownAz size={14} /></div>;
    return sortOrder === 'asc' ? <ArrowUpAz size={14} color="var(--accent-primary)" /> : <ArrowDownAz size={14} color="var(--accent-primary)" />;
  };

  return (
    <div className="documents-view">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Buscar por nombre de documento..." 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            Subir Documento
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', alignItems: 'center', scrollbarWidth: 'none' }}>
          <button 
            className={`btn ${categoryFilter === 'Todas' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCategoryFilter('Todas')}
            style={{ 
              padding: '0.6rem 1.5rem', 
              fontSize: '0.9rem', 
              borderRadius: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              boxShadow: categoryFilter === 'Todas' ? '0 4px 15px rgba(99, 102, 241, 0.3)' : 'none'
            }}
          >
            Todas 
            <span style={{ 
              fontSize: '0.8rem', 
              fontWeight: 800,
              background: categoryFilter === 'Todas' ? 'rgba(255,255,255,0.3)' : 'var(--accent-primary)',
              color: 'white',
              padding: '3px 12px',
              borderRadius: '12px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              minWidth: '28px',
              display: 'inline-flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              {counts['Todas']}
            </span>
          </button>
          
          {categories.map(cat => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
              <button 
                className={`btn ${categoryFilter === cat ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCategoryFilter(cat)}
                style={{ 
                  padding: '0.6rem 1.5rem', 
                  fontSize: '0.9rem', 
                  paddingRight: '3.2rem',
                  borderRadius: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  boxShadow: categoryFilter === cat ? '0 4px 15px rgba(99, 102, 241, 0.3)' : 'none'
                }}
              >
                {cat} 
                <span style={{ 
                  fontSize: '0.8rem', 
                  fontWeight: 800,
                  background: categoryFilter === cat ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                  color: categoryFilter === cat ? 'white' : 'var(--text-primary)',
                  padding: '3px 12px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  minWidth: '28px',
                  display: 'inline-flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  {counts[cat] || 0}
                </span>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); deleteCategory(cat); }}
                style={{ 
                  position: 'absolute', 
                  right: '0.8rem', 
                  background: 'none', 
                  border: 'none', 
                  color: categoryFilter === cat ? 'white' : 'var(--error)', 
                  cursor: 'pointer',
                  padding: '5px',
                  opacity: 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.2s ease',
                  zIndex: 2
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '0.6'}
                title="Eliminar categoría"
              >
                <X size={16} />
              </button>
            </div>
          ))}

          {counts['Sin categoría'] > 0 && (
            <button 
              className={`btn ${categoryFilter === 'Sin categoría' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setCategoryFilter('Sin categoría')}
              style={{ 
                padding: '0.6rem 1.5rem', 
                fontSize: '0.9rem', 
                borderRadius: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                boxShadow: categoryFilter === 'Sin categoría' ? '0 4px 15px rgba(239, 68, 68, 0.3)' : 'none'
              }}
            >
              Sin Categoría 
              <span style={{ 
                fontSize: '0.8rem', 
                fontWeight: 800,
                background: categoryFilter === 'Sin categoría' ? 'rgba(255,255,255,0.3)' : 'rgba(239, 68, 68, 0.2)',
                color: categoryFilter === 'Sin categoría' ? 'white' : 'var(--error)',
                padding: '3px 12px',
                borderRadius: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                minWidth: '28px',
                display: 'inline-flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                {counts['Sin categoría']}
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th onClick={() => toggleSort('name')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Documento <SortIcon field="name" />
                </div>
              </th>
              <th onClick={() => toggleSort('category')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Categoría <SortIcon field="category" />
                </div>
              </th>
              <th onClick={() => toggleSort('documentDate')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Fecha Doc <SortIcon field="documentDate" />
                </div>
              </th>
              <th onClick={() => toggleSort('uploadDate')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Subido <SortIcon field="uploadDate" />
                </div>
              </th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.map((doc) => (
              <tr key={doc.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ pading: '0.5rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px' }}>
                      <FileText size={18} color="var(--accent-primary)" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{doc.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{doc.fileName}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="status-badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)' }}>
                    {doc.category}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <Calendar size={14} color="var(--text-secondary)" />
                    {doc.documentDate ? format(parseSafeDate(doc.documentDate), 'dd MMM yyyy', { locale: es }) : '---'}
                  </div>
                </td>
                <td>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {doc.uploadDate ? format(parseSafeDate(doc.uploadDate), 'dd/MM/yy HH:mm') : '---'}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}>
                    {isFirebasePath(doc.fileUrl) ? (
                      <div
                        title="Archivo en Firebase (no accesible). Vuelve a subirlo."
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.35rem',
                          padding: '0.3rem 0.6rem', borderRadius: '0.5rem',
                          background: 'rgba(239,68,68,0.1)', color: 'var(--error)',
                          fontSize: '0.7rem', fontWeight: 600, cursor: 'default'
                        }}
                      >
                        <AlertTriangle size={13} /> Firebase
                      </div>
                    ) : (
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.4rem' }} 
                        onClick={() => openFile(doc.fileUrl)}
                        title="Ver/Descargar"
                      >
                        <Download size={16} />
                      </button>
                    )}
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.4rem', color: 'var(--error)' }} 
                      onClick={() => handleDelete(doc.id, doc.fileUrl)}
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredDocs.length === 0 && (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  No se encontraron documentos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2>Subir Nuevo Documento</h2>
              <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Archivo</label>
                <div 
                  onClick={() => fileInputRef.current.click()}
                  style={{ 
                    border: '2px dashed var(--glass-border)', 
                    borderRadius: '1rem', 
                    padding: '2rem', 
                    textAlign: 'center', 
                    cursor: 'pointer',
                    background: form.file ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    hidden 
                    onChange={handleFileChange}
                  />
                  {!form.file ? (
                    <>
                      <Upload size={32} style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }} />
                      <p>Haz clic para seleccionar un archivo</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>PDF, Imágenes, etc.</p>
                    </>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                      <FileText size={32} color="var(--accent-primary)" />
                      <div style={{ textAlign: 'left' }}>
                        <p style={{ fontWeight: 600 }}>{form.fileName}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{(form.file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Nombre del Documento</label>
                <input 
                  type="text" 
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Contrato Arrendamiento 2024"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Categoría</label>
                  <select 
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="new">+ Nueva Categoría</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Fecha del Documento</label>
                  <input 
                    type="date" 
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>
              </div>

              {form.category === 'new' && (
                <div className="form-group" style={{ animation: 'fadeIn 0.3s ease' }}>
                  <label>Nombre de la Nueva Categoría</label>
                  <div style={{ position: 'relative' }}>
                    <Tag size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-primary)' }} />
                    <input 
                      type="text" 
                      value={form.newCategory}
                      onChange={(e) => setForm({ ...form, newCategory: e.target.value })}
                      placeholder="Ej: Seguros"
                      style={{ paddingLeft: '2.5rem' }}
                      autoFocus
                      required
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={uploading}>
                  {uploading ? 'Subiendo...' : 'Guardar Documento'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal} style={{ flex: 1 }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
};

export default Documents;
