import { supabase } from '../supabase';

/**
 * Uploads a file to Supabase private Storage.
 * Returns the STORAGE PATH (not a URL) for saving in the database.
 */
export const uploadFile = async (file, folder = 'records') => {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}_${safeName}`;
  const { error } = await supabase.storage.from('comprobantes').upload(path, file);
  if (error) throw error;
  return path; // Always store the PATH, never a public URL
};

/**
 * Generates a signed URL for a private file path (valid for 1 hour).
 * Also handles old Firebase URLs gracefully (returns them as-is for now).
 */
export const getSignedUrl = async (pathOrUrl, expiresIn = 3600) => {
  if (!pathOrUrl) return null;
  // Old Firebase URLs — these are broken but we return them so UI can show the error gracefully
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  // Supabase Storage path — generate signed URL
  const { data, error } = await supabase.storage
    .from('comprobantes')
    .createSignedUrl(pathOrUrl, expiresIn);
  if (error) { console.error('Signed URL error:', error); return null; }
  return data.signedUrl;
};

/**
 * Opens a private file in a new tab using a signed URL.
 */
export const openFile = async (pathOrUrl) => {
  const url = await getSignedUrl(pathOrUrl);
  if (!url) { alert('No se pudo acceder al archivo.'); return; }
  if (url.includes('firebasestorage')) {
    alert('Este archivo estaba en Firebase Storage (servicio anterior) y ya no es accesible. Por favor sube el comprobante de nuevo desde tu dispositivo.');
    return;
  }
  window.open(url, '_blank');
};

/**
 * Checks if a path/url points to a broken Firebase file.
 */
export const isFirebasePath = (pathOrUrl) =>
  pathOrUrl?.includes('firebasestorage') || pathOrUrl?.includes('googleapis.com/storage');
