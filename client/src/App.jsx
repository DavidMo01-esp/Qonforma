import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { api, getToken, getStoredUser, clearSession } from './api.js';
import Login from './pages/Login.jsx';
import DailyLog from './pages/DailyLog.jsx';
import Samples from './pages/Samples.jsx';
import SampleDetail from './pages/SampleDetail.jsx';
import Products from './pages/Products.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Alerts from './pages/Alerts.jsx';
import Lot from './pages/Lot.jsx';

const ICONS = {
  daily: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2.5V6M16 2.5V6" />
    </svg>
  ),
  alerts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </svg>
  ),
  products: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z" />
      <path d="M3.3 7l8.7 5 8.7-5M12 22V12" />
    </svg>
  ),
  samples: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2v6.3L4.2 19a2 2 0 0 0 1.8 3h12a2 2 0 0 0 1.8-3L14 8.3V2" />
      <path d="M8.5 2h7M7 15h10" />
    </svg>
  ),
};

function ChangePasswordModal({ onClose }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (next !== confirmPwd) {
      setError('La contraseña nueva no coincide en los dos campos');
      return;
    }
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { current_password: current, new_password: next },
      });
      setDone(true);
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2>Cambiar contraseña</h2>
        {error && <div className="alert-error">{error}</div>}
        {done ? (
          <p className="muted">Contraseña actualizada ✔</p>
        ) : (
          <>
            <label>
              Contraseña actual
              <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus required />
            </label>
            <label>
              Contraseña nueva
              <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
            </label>
            <label>
              Repite la contraseña nueva
              <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required />
            </label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary">Guardar</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

function Layout({ user, onLogout, theme, onToggleTheme, children }) {
  const [openAlerts, setOpenAlerts] = useState(0);
  const [showPwd, setShowPwd] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('qc_nav_collapsed') === '1');
  const [lotQuery, setLotQuery] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  async function searchLot(e) {
    e.preventDefault();
    const q = lotQuery.trim();
    if (!q) return;
    try {
      const lot = await api(`/lots/${encodeURIComponent(q)}`);
      const day = lot.samples[0].received_at.slice(0, 10);
      navigate(`/?date=${day}&lot=${encodeURIComponent(lot.batch)}`);
      setLotQuery('');
    } catch (err) {
      alert(err.message);
    }
  }

  function toggleNav() {
    setCollapsed((c) => {
      localStorage.setItem('qc_nav_collapsed', c ? '0' : '1');
      return !c;
    });
  }

  async function downloadBackup() {
    try {
      const res = await fetch('/api/backup', { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error('No se pudo generar la copia');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        res.headers.get('content-disposition')?.match(/filename="?([^";]+)/)?.[1] || 'qonforma-backup.db';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.message);
    }
  }

  useEffect(() => {
    api('/alerts?status=open')
      .then((alerts) => setOpenAlerts(alerts.length))
      .catch(() => {});
  }, [location.pathname]);

  return (
    <div className={`layout ${collapsed ? 'nav-collapsed' : ''}`}>
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <button
          className="nav-toggle"
          onClick={toggleNav}
          title={collapsed ? 'Expandir menú' : 'Plegar menú'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <div className="brand">
          <span className="brand-mark">Q</span>
          <div className="brand-block">
            <span className="brand-text">QONFORMA</span>
            <span className="brand-sub">Control de calidad</span>
          </div>
        </div>
        <form className="side-search" onSubmit={searchLot} title="Buscar un lote y abrir su ficha">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            placeholder="Buscar lote…"
            value={lotQuery}
            onChange={(e) => setLotQuery(e.target.value)}
          />
        </form>
        <nav>
          <span className="nav-section">Trabajo</span>
          <NavLink to="/" end title="Registro diario">
            {ICONS.daily}
            <span>Registro diario</span>
          </NavLink>
          <NavLink to="/alerts" title="Alertas">
            {ICONS.alerts}
            <span>Alertas</span>
            {openAlerts > 0 && <span className="nav-badge">{openAlerts}</span>}
          </NavLink>
          <span className="nav-section">Maestros</span>
          <NavLink to="/products" title="Productos">
            {ICONS.products}
            <span>Productos</span>
          </NavLink>
          <NavLink to="/samples" title="Muestras">
            {ICONS.samples}
            <span>Muestras</span>
          </NavLink>
        </nav>
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {theme === 'dark' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4.5" />
              <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          )}
          <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
        </button>
        {user?.role === 'admin' && (
          <button
            className="theme-toggle"
            onClick={downloadBackup}
            title="Descargar una copia de seguridad de la base de datos"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="8" ry="3" />
              <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
            </svg>
            <span>Copia de seguridad</span>
          </button>
        )}
        <div className="sidebar-footer">
          <div className="user-avatar">{(user?.username || '?')[0].toUpperCase()}</div>
          <div className="user-meta">
            <span className="user-name">{user?.username}</span>
            <button className="btn-logout" onClick={() => setShowPwd(true)}>Cambiar contraseña</button>
            <button className="btn-logout" onClick={onLogout}>Cerrar sesión</button>
          </div>
        </div>
      </aside>
      <main className="content">{children}</main>
      {showPwd && <ChangePasswordModal onClose={() => setShowPwd(false)} />}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(getStoredUser());
  const [theme, setTheme] = useState(() => localStorage.getItem('qc_theme') || 'light');
  const navigate = useNavigate();
  const authed = Boolean(getToken()) && user;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('qc_theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  function handleLogout() {
    clearSession();
    setUser(null);
    navigate('/login');
  }

  if (!authed) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={setUser} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout user={user} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme}>
      <Routes>
        <Route path="/" element={<DailyLog />} />
        <Route path="/samples" element={<Samples />} />
        <Route path="/samples/:id" element={<SampleDetail />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/lots/:batch" element={<Lot />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
