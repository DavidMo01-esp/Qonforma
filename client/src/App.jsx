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

function Layout({ user, onLogout, children }) {
  const [openAlerts, setOpenAlerts] = useState(0);
  const [showPwd, setShowPwd] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api('/alerts?status=open')
      .then((alerts) => setOpenAlerts(alerts.length))
      .catch(() => {});
  }, [location.pathname]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">Q</span>
          <div className="brand-block">
            <span className="brand-text">QONFORMA</span>
            <span className="brand-sub">Control de calidad</span>
          </div>
        </div>
        <nav>
          <span className="nav-section">Trabajo</span>
          <NavLink to="/" end>
            {ICONS.daily}
            <span>Registro diario</span>
          </NavLink>
          <NavLink to="/alerts">
            {ICONS.alerts}
            <span>Alertas</span>
            {openAlerts > 0 && <span className="nav-badge">{openAlerts}</span>}
          </NavLink>
          <span className="nav-section">Maestros</span>
          <NavLink to="/products">
            {ICONS.products}
            <span>Productos</span>
          </NavLink>
          <NavLink to="/samples">
            {ICONS.samples}
            <span>Muestras</span>
          </NavLink>
        </nav>
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
  const navigate = useNavigate();
  const authed = Boolean(getToken()) && user;

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
    <Layout user={user} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<DailyLog />} />
        <Route path="/samples" element={<Samples />} />
        <Route path="/samples/:id" element={<SampleDetail />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
