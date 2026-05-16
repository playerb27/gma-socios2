import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Wallet, Mail, Lock } from 'lucide-react';
import '../index.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetStatus, setResetStatus] = useState('idle');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
    } catch (err) {
      console.error('Login error:', err);
      setError('Credenciales inválidas o error de conexión. Verifica tu email y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      alert('Primero escribe tu correo electrónico en el campo de arriba.');
      return;
    }
    setResetStatus('sending');
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email);
      if (err) throw err;
      setResetStatus('sent');
    } catch (err) {
      console.error('Reset error:', err);
      setResetStatus('error');
    }
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        <div style={{ textAlign: 'center' }}>
          <div className="sidebar-logo" style={{ justifyContent: 'center', marginBottom: '1rem', fontSize: '2rem' }}>
            <Wallet size={36} />
            <span>GMA SOCIOS</span>
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>Ingresa a tu cuenta para continuar</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', padding: '1rem', borderRadius: '0.75rem', fontSize: '0.875rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {resetStatus === 'sent' && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '1rem', borderRadius: '0.75rem', fontSize: '0.875rem', textAlign: 'center' }}>
            ✅ Te enviamos un correo a <strong>{email}</strong> para restablecer tu contraseña.
          </div>
        )}

        {resetStatus === 'error' && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', padding: '1rem', borderRadius: '0.75rem', fontSize: '0.875rem', textAlign: 'center' }}>
            ❌ No se pudo enviar el correo. ¿El email está bien escrito?
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Correo Electrónico</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" style={{ paddingLeft: '3rem' }} required />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ paddingLeft: '3rem' }} required />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Iniciando sesión...' : 'Ingresar'}
          </button>
        </form>

        <div style={{ textAlign: 'center', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1rem' }}>
            ¿Olvidaste tu contraseña? Escribe tu correo arriba y haz clic aquí:
          </p>
          <button type="button" onClick={handleForgotPassword} disabled={resetStatus === 'sending' || resetStatus === 'sent'}
            style={{ background: 'none', border: '1px solid var(--glass-border)', color: 'var(--accent-primary)', cursor: 'pointer', padding: '0.6rem 1.5rem', borderRadius: '0.75rem', fontSize: '0.875rem', width: '100%' }}
          >
            {resetStatus === 'sending' ? 'Enviando correo...' : resetStatus === 'sent' ? '✅ Correo enviado' : '🔑 Recuperar contraseña'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
