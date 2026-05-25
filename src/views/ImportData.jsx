import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { 
  Upload, CheckCircle2, Loader2, Database, AlertCircle, 
  ImageIcon, Link, RefreshCw, FileText, Trash2, Eye
} from 'lucide-react';

// Converts any Firestore date format to a valid ISO string for PostgreSQL
const parseDate = (val) => {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  const secs = val.seconds ?? val._seconds;
  if (secs !== undefined) return new Date(secs * 1000).toISOString();
  return new Date().toISOString();
};

// ─── TAB: IMPORTAR DATOS ────────────────────────────────────────────────────
const ImportTab = () => {
  const [status, setStatus] = useState('idle');
  const [log, setLog] = useState([]);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [migrateFiles, setMigrateFiles] = useState(false);

  const addLog = (msg, type = 'info') =>
    setLog(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]);

  const handleImport = async () => {
    if (!file) return alert('Selecciona el archivo gma-backup-supabase.json primero');
    if (!window.confirm('⚠️ Este proceso limpiará y reimportará todos los datos.\n\n¿Continuar?')) return;

    setStatus('loading'); setLog([]); setProgress({ current: 0, total: 0 });
    try {
      const backup = JSON.parse(await file.text());

      addLog('🧹 Limpiando tablas...', 'warn');
      for (const t of ['returns', 'records', 'socios', 'cashflow']) {
        const { error } = await supabase.from(t).delete().gte('created_at', '2000-01-01');
        addLog(error ? `⚠️ "${t}": ${error.message}` : `🗑️  "${t}" limpiada`, error ? 'warn' : 'info');
      }

      const insertBatch = async (table, rows) => {
        if (!rows?.length) { addLog(`⏭️  ${table}: sin datos`, 'warn'); return; }
        addLog(`⏳ Importando ${rows.length} en "${table}"...`);
        for (let i = 0; i < rows.length; i += 50) {
          const { error } = await supabase.from(table).insert(rows.slice(i, i + 50));
          if (error) addLog(`❌ "${table}": ${error.message}`, 'error');
        }
        addLog(`✅ "${table}" listo (${rows.length})`, 'success');
      };

      // SOCIOS
      await insertBatch('socios', (backup.socios || []).map(s => ({
        nombre: s.nombre || s.socio || 'Sin Nombre', email: s.email || '',
        telefono: s.telefono || '', notas: s.notas || '',
        created_at: parseDate(s.createdAt || s.created_at)
      })));

      // RECORDS
      const recordRows = (backup.records || []).map(r => ({
        socio: r.socio || r.nombreInversionista || '',
        socio_id: null, cantidad: Number(r.cantidad || r.valor || 0),
        valor: String(r.valor || r.cantidad || '0'), tipo: r.tipo || 'dinero',
        fecha: parseDate(r.fecha), descripcion: r.descripcion || '',
        file_urls: r.fileUrls || r.file_urls || [], // keep original URLs (will fix via re-link tool)
        num_archivos: (r.fileUrls || r.file_urls || []).length,
        moneda: r.moneda || 'MXN', history: r.history || [],
        created_at: parseDate(r.createdAt || r.created_at || r.fecha),
        updated_at: parseDate(r.updatedAt || r.updated_at)
      }));
      await insertBatch('records', recordRows);

      // RETURNS
      await insertBatch('returns', (backup.returns || []).map(r => ({
        socio_id: null, nombre_inversionista: r.nombreInversionista || r.socio || '',
        cantidad: Number(r.cantidad || 0), fecha: parseDate(r.fecha),
        tipo: r.tipo || 'dinero', categoria: r.categoria || 'recuperacion',
        file_urls: r.fileUrls || r.file_urls || [], descripcion: r.descripcion || '',
        payout_month: r.payoutMonth || null, paid_by: r.paidBy || null,
        is_reintegro: r.isReintegro || false, created_at: parseDate(r.createdAt || r.created_at)
      })));

      // CASHFLOW
      const cfRows = (backup.cashflow || []).map(c => ({
        mes: c.mes, ingresos: Number(c.ingresos || 0),
        gastos_fijos: Number(c.gastosFijos || 0), gastos_variables: Number(c.gastosVariables || 0),
        sueldo_doctor: Number(c.sueldoDoctor || 95000), utilidad: Number(c.utilidad || 0),
        items_ingresos: c.itemsIngresos || [], items_fijos: c.itemsFijos || [],
        items_variables: c.itemsVariables || [], rules: c.rules || null,
        created_at: parseDate(c.createdAt), updated_at: parseDate(c.updatedAt)
      }));
      if (cfRows.length) {
        const { error } = await supabase.from('cashflow').upsert(cfRows, { onConflict: 'mes' });
        addLog(error ? `❌ cashflow: ${error.message}` : `✅ "cashflow" listo (${cfRows.length})`, error ? 'error' : 'success');
      }

      // SETTINGS
      if (backup.settings) {
        const s = Array.isArray(backup.settings) ? backup.settings[0] : backup.settings;
        await supabase.from('settings').upsert({ id: 'financials', rules: s?.rules || null });
        addLog('✅ "settings" listo', 'success');
      }

      setStatus('done');
      addLog('🎉 ¡Importación completada! Ve a "Re-vincular Archivos" para restaurar las imágenes.', 'success');
    } catch (err) {
      setStatus('error');
      addLog(`❌ Error: ${err.message}`, 'error');
    }
  };

  return (
    <div>
      <div onClick={() => (status === 'idle' || status === 'error') && document.getElementById('imp-file').click()}
        style={{ border: `2px dashed ${file ? 'var(--success)' : 'var(--glass-border)'}`, borderRadius: '1rem', padding: '2rem', textAlign: 'center', cursor: 'pointer', marginBottom: '1.5rem' }}>
        <input id="imp-file" type="file" accept=".json" hidden onChange={e => { const f = e.target.files[0]; if (f) setFile(f); }} />
        {file ? <div style={{ color: 'var(--success)' }}><CheckCircle2 size={28} /><p style={{ fontWeight: 700 }}>{file.name}</p></div>
          : <div style={{ color: 'var(--text-secondary)' }}><Upload size={28} /><p>Seleccionar gma-backup-supabase.json</p></div>}
      </div>
      {status === 'done' ? (
        <div style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)', padding: '1rem', borderRadius: '0.75rem', textAlign: 'center' }}>
          <CheckCircle2 size={24} /><p style={{ fontWeight: 700 }}>¡Completado! Ahora ve a "Re-vincular Archivos"</p>
          <a href="/" style={{ color: 'var(--accent-primary)', fontSize: '0.875rem' }}>O ir al Panel de Control →</a>
        </div>
      ) : (
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleImport} disabled={!file || status === 'loading'}>
          {status === 'loading' ? <><Loader2 className="animate-spin" size={18} /> Importando...</> : <><Database size={18} /> Iniciar Importación</>}
        </button>
      )}
      {log.length > 0 && (
        <div style={{ marginTop: '1.5rem', fontFamily: 'monospace', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '250px', overflowY: 'auto' }}>
          {log.map((e, i) => (
            <div key={i} style={{ padding: '0.3rem 0.75rem', borderRadius: '0.4rem', background: e.type === 'success' ? 'rgba(16,185,129,0.1)' : e.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)', color: e.type === 'success' ? 'var(--success)' : e.type === 'error' ? 'var(--error)' : 'var(--text-secondary)' }}>
              <span style={{ opacity: 0.4, marginRight: '0.5rem' }}>{e.time}</span>{e.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── TAB: RE-VINCULAR ARCHIVOS ──────────────────────────────────────────────
const RelinkTab = () => {
  const [storageFiles, setStorageFiles] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null); // { recordId, fileIndex }
  const fileInputRef = useRef(null);

  const loadData = async () => {
    setLoading(true);
    // Load storage files from all known subfolders
    const folders = ['records', 'documents', 'business_documents', 'comprobantes'];
    let allFiles = [];
    for (const folder of folders) {
      const { data: files } = await supabase.storage.from('comprobantes').list(folder, { limit: 500, sortBy: { column: 'name', order: 'asc' } });
      if (files?.length) {
        allFiles = [...allFiles, ...files.map(f => ({
          name: f.name,
          path: `${folder}/${f.name}`,
          folder,
          size: f.metadata?.size
        }))];
      }
    }
    setStorageFiles(allFiles);
    // Load all records with their file_urls
    const { data: recs } = await supabase.from('records').select('id, socio, cantidad, fecha, descripcion, file_urls').order('fecha');
    setRecords(recs || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const uploadNewFile = async (recordId, file) => {
    setSaving(recordId);
    try {
      const folder = file.type.includes('pdf') ? 'documents' : 'records';
      const path = `${folder}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error } = await supabase.storage.from('comprobantes').upload(path, file);
      if (error) throw error;
      // Store the PATH (not public URL) — consistent with new system
      const rec = records.find(r => r.id === recordId);
      const currentPaths = (rec.file_urls || []).filter(u => !isFirebaseUrl(u));
      const newPaths = [...currentPaths, path];
      await supabase.from('records').update({ file_urls: newPaths, num_archivos: newPaths.length }).eq('id', recordId);
      await loadData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  const attachStorageFile = async (recordId, storagePath) => {
    setSaving(recordId);
    try {
      const rec = records.find(r => r.id === recordId);
      const currentPaths = (rec.file_urls || []).filter(u => !isFirebaseUrl(u));
      if (currentPaths.includes(storagePath)) { setSaving(null); return; }
      const newPaths = [...currentPaths, storagePath];
      await supabase.from('records').update({ file_urls: newPaths, num_archivos: newPaths.length }).eq('id', recordId);
      await loadData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  const removeUrl = async (recordId, urlToRemove) => {
    setSaving(recordId);
    const rec = records.find(r => r.id === recordId);
    const newUrls = (rec.file_urls || []).filter(u => u !== urlToRemove);
    await supabase.from('records').update({ file_urls: newUrls, num_archivos: newUrls.length }).eq('id', recordId);
    await loadData();
    setSaving(null);
  };

  const isFirebaseUrl = url => url?.includes('firebasestorage') || url?.includes('googleapis.com');

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}><Loader2 className="animate-spin" size={32} /></div>;

  const recordsWithFirebase = records.filter(r => (r.file_urls || []).some(isFirebaseUrl));
  const recordsOk = records.filter(r => (r.file_urls || []).length > 0 && !(r.file_urls || []).some(isFirebaseUrl));
  const recordsEmpty = records.filter(r => !r.file_urls || r.file_urls.length === 0);

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.75rem', padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--error)' }}>{recordsWithFirebase.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Con URL Firebase (roto)</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '0.75rem', padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>{recordsOk.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Con archivo Supabase ✓</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '0.75rem', padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-secondary)' }}>{recordsEmpty.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sin archivos</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '0.75rem', padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{storageFiles.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Archivos en Storage</div>
        </div>
      </div>

      {/* Storage Files Available */}
      {storageFiles.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '1rem', letterSpacing: '0.05em' }}>
            📦 Archivos en Supabase Storage ({storageFiles.length})
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {storageFiles.map((f, i) => (
              <div key={i} style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid var(--success)', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.75rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Eye size={12} />
                <span title={f.path}>{f.folder}/{f.name.slice(0, 20)}{f.name.length > 20 ? '...' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Records with Firebase URLs first */}
      <h3 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '1rem', letterSpacing: '0.05em' }}>
        📋 Inversiones ({records.length} total)
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {records.map(rec => {
          const firebaseUrls = (rec.file_urls || []).filter(isFirebaseUrl);
          const goodPaths = (rec.file_urls || []).filter(u => !isFirebaseUrl(u));
          const hasIssue = firebaseUrls.length > 0;

          return (
            <div key={rec.id} className="card" style={{ borderLeft: `4px solid ${hasIssue ? 'var(--error)' : goodPaths.length > 0 ? 'var(--success)' : 'var(--glass-border)'}`, padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <p style={{ fontWeight: 700, margin: 0 }}>{rec.socio}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(rec.cantidad)} — {rec.descripcion || 'Sin descripción'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="file" hidden ref={fileInputRef} accept="image/*,application/pdf"
                    onChange={async (e) => {
                      if (e.target.files[0] && selectedFile?.recordId === rec.id) {
                        await uploadNewFile(rec.id, e.target.files[0]);
                        e.target.value = '';
                      }
                    }}
                  />
                  <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem' }}
                    disabled={saving === rec.id}
                    onClick={() => { setSelectedFile({ recordId: rec.id }); fileInputRef.current.click(); }}>
                    {saving === rec.id ? <Loader2 className="animate-spin" size={14} /> : <><Upload size={14} /> Subir archivo</>}
                  </button>
                </div>
              </div>

              {/* Firebase URLs (broken) */}
              {firebaseUrls.length > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.08)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '0.75rem' }}>
                  <p style={{ fontSize: '0.7rem', color: 'var(--error)', margin: '0 0 0.5rem', fontWeight: 600 }}>⛔ URL de Firebase (no accesible) — sube el archivo de nuevo:</p>
                  {firebaseUrls.map((url, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url.slice(0, 70)}...</span>
                      <button onClick={() => removeUrl(rec.id, url)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '2px' }}><Trash2 size={12} /></button>
                    </div>
                  ))}
                  {storageFiles.length > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>O vincular con archivo ya subido a Supabase Storage:</p>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {storageFiles.map((sf, i) => (
                          <button key={i} className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem' }}
                            onClick={() => attachStorageFile(rec.id, sf.path)}>
                            <Link size={10} /> {sf.folder}/{sf.name.slice(0, 15)}...
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Good Supabase paths */}
              {goodPaths.map((path, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16,185,129,0.08)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', marginBottom: '0.4rem' }}>
                  <CheckCircle2 size={14} color="var(--success)" />
                  <span style={{ fontSize: '0.75rem', color: 'var(--success)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    ✅ {path.startsWith('http') ? 'URL Supabase (legacy)' : `Path: ${path}`}
                  </span>
                  <button onClick={() => removeUrl(rec.id, path)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}><Trash2 size={12} /></button>
                </div>
              ))}

              {rec.file_urls?.length === 0 && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Sin archivos adjuntos</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
const ImportData = () => {
  const [tab, setTab] = useState('relink'); // start on relink since data is already imported

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <Database size={32} color="var(--accent-primary)" />
          <div>
            <h2 style={{ margin: 0 }}>Herramientas de Migración</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Importar datos y gestionar archivos adjuntos</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
          {[
            { id: 'relink', label: '🔗 Re-vincular Archivos', desc: 'Restaurar imágenes de comprobantes' },
            { id: 'import', label: '📦 Importar Datos', desc: 'Re-importar desde JSON backup' }
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`btn ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.875rem' }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'import' ? <ImportTab /> : <RelinkTab />}
      </div>
    </div>
  );
};

export default ImportData;
