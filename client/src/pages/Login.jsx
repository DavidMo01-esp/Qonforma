import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, saveSession } from '../api.js';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    fetch('/api/meta')
      .then((r) => r.json())
      .then((d) => setIsDemo(Boolean(d.demo)))
      .catch(() => {});
  }, []);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api(`/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        body: { username, password },
      });
      saveSession(data.token, data.user);
      onLogin(data.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      <form className="card login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <img src="/icon.png" alt="QONFORMA" className="brand-mark brand-img" />
        </div>
        <h1>QONFORMA</h1>
        <p className="muted">{mode === 'login' ? 'Inicia sesión para continuar' : 'Crea una cuenta nueva'}</p>
        {isDemo && (
          <div className="demo-box">
            <strong>Demo pública</strong> — entra con <code>demo</code> / <code>demo1234</code>
            <span>Los datos son de ejemplo y se restablecen periódicamente.</span>
          </div>
        )}
        {error && <div className="alert-error">{error}</div>}
        <label>
          Usuario
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button className="btn btn-primary" disabled={loading}>
          {loading ? 'Enviando…' : mode === 'login' ? 'Entrar' : 'Registrarse'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
          }}
        >
          {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </form>
    </div>
  );
}
