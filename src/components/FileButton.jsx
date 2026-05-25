import React, { useState } from 'react';
import { Loader2, FileText, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { openFile, isFirebasePath } from '../utils/storage';

/**
 * FileButton — renders a secure button that opens a private Supabase Storage file
 * via a signed URL. Handles broken Firebase URLs gracefully.
 */
const FileButton = ({ pathOrUrl, label, index = 0 }) => {
  const [loading, setLoading] = useState(false);

  const isFirebase = isFirebasePath(pathOrUrl);
  const isImage = /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(pathOrUrl || '');

  const handleClick = async () => {
    if (isFirebase) {
      alert('Este comprobante estaba guardado en el sistema anterior (Firebase) y ya no es accesible.\n\nPor favor sube el comprobante de nuevo desde la vista de Inversiones → Editar.');
      return;
    }
    setLoading(true);
    await openFile(pathOrUrl);
    setLoading(false);
  };

  return (
    <button
      onClick={handleClick}
      title={isFirebase ? `⛔ Firebase URL (no accesible): ${pathOrUrl}` : `✅ Supabase path: ${pathOrUrl}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
        padding: '0.35rem 0.7rem', borderRadius: '0.5rem', cursor: 'pointer',
        fontSize: '0.75rem', fontWeight: 500, border: 'none', transition: 'all 0.2s',
        background: isFirebase ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.12)',
        color: isFirebase ? 'var(--error)' : 'var(--accent-primary)',
        opacity: loading ? 0.7 : 1
      }}
    >
      {loading
        ? <Loader2 size={13} className="animate-spin" />
        : isFirebase
          ? <AlertTriangle size={13} />
          : isImage ? <ImageIcon size={13} /> : <FileText size={13} />
      }
      {label || `Doc ${index + 1}`}
    </button>
  );
};

export default FileButton;
