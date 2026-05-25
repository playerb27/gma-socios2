import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { 
  Users, Wallet, PieChart as PieChartIcon, LayoutDashboard, Plus, Search, Filter,
  FileText, Image as ImageIcon, Calendar, DollarSign, Undo2, TrendingUp, CreditCard, LogOut, Wrench
} from 'lucide-react';

import Dashboard from './views/Dashboard';
import Partners from './views/Partners';
import Investments from './views/Investments';
import Returns from './views/Returns';
import Documents from './views/Documents';
import CashFlow from './views/CashFlow';
import Payouts from './views/Payouts';
import Login from './views/Login';
import ImportData from './views/ImportData';
import { supabase } from './supabase';
import './index.css';

const Sidebar = () => {
  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <Wallet size={28} />
        <span>GMA SOCIOS</span>
      </div>
      <nav className="nav-links">
        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={20} /> Panel de Control
        </NavLink>
        <NavLink to="/socios" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Users size={20} /> Inversionistas
        </NavLink>
        <NavLink to="/inversiones" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <DollarSign size={20} /> Inversiones
        </NavLink>
        <NavLink to="/retornos" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Undo2 size={20} /> Retornos
        </NavLink>
        <NavLink to="/documentos" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <FileText size={20} /> Documentos
        </NavLink>
        <NavLink to="/finanzas" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <TrendingUp size={20} /> Finanzas
        </NavLink>
        <NavLink to="/pagos" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <CreditCard size={20} /> Pagos
        </NavLink>
        <NavLink to="/herramientas" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} style={{ marginTop: 'auto', opacity: 0.6 }}>
          <Wrench size={20} /> Herramientas
        </NavLink>
      </nav>
    </div>
  );
};

const Header = () => {
  const location = useLocation();
  const getTitle = () => {
    switch(location.pathname) {
      case '/': return 'Panel de Control';
      case '/socios': return 'Resumen de Inversiones';
      case '/inversiones': return 'Registro de Inversiones';
      case '/retornos': return 'Gestión de Retornos';
      case '/documentos': return 'Repositorio de Documentos';
      case '/finanzas': return 'Flujo de Caja y Utilidades';
      case '/pagos': return 'Control de Repartos Mensuales';
      default: return 'GMA SOCIOS';
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h1>{getTitle()}</h1>
      <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>Administrador</p>
          <button 
            onClick={handleSignOut} 
            style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0 }}
          >
            Cerrar Sesión
          </button>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }} />
      </div>
    </div>
  );
};

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Cargando aplicación...</p>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Header />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/socios" element={<Partners />} />
            <Route path="/inversiones" element={<Investments />} />
            <Route path="/retornos" element={<Returns />} />
            <Route path="/documentos" element={<Documents />} />
            <Route path="/finanzas" element={<CashFlow />} />
            <Route path="/pagos" element={<Payouts />} />
            <Route path="/herramientas" element={<ImportData />} />

          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
