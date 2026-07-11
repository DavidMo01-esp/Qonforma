import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('open');
  const [error, setError] = useState('');

  async function load() {
    setAlerts(await api(`/alerts${filter ? `?status=${filter}` : ''}`));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [filter]);

  async function act(alert, action) {
    try {
      await api(`/alerts/${alert.id}/${action}`, { method: 'PATCH' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(alert) {
    if (!confirm('¿Eliminar esta alerta?')) return;
    try {
      await api(`/alerts/${alert.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Alertas</h1>
          <p className="muted page-sub">Resultados fuera de especificación y su seguimiento</p>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="open">Abiertas</option>
          <option value="resolved">Resueltas</option>
          <option value="">Todas</option>
        </select>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <table className="table">
        <thead>
          <tr>
            <th>Estado</th>
            <th>Producto</th>
            <th>Lote</th>
            <th>Envase</th>
            <th>Mensaje</th>
            <th>Creada</th>
            <th>Resuelta</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => (
            <tr key={a.id} className={a.status === 'open' ? 'row-out-of-spec' : ''}>
              <td>
                {a.status === 'open'
                  ? <span className="badge badge-alert">⚠ Abierta</span>
                  : <span className="badge badge-ok">✔ Resuelta</span>}
              </td>
              <td>{a.sample_product}</td>
              <td>
                <Link to={`/samples/${a.sample_id}`} className="lot-link">
                  {a.sample_batch || 'sin lote'}
                </Link>
              </td>
              <td>{a.sample_container ? `nº ${a.sample_container}` : '—'}</td>
              <td>{a.message}</td>
              <td>{a.created_at}</td>
              <td>{a.resolved_at ? `${a.resolved_at} (${a.resolved_by_name || '?'})` : '—'}</td>
              <td className="row-actions">
                {a.status === 'open' ? (
                  <button className="btn btn-small btn-primary" onClick={() => act(a, 'resolve')}>Resolver</button>
                ) : (
                  <button className="btn btn-small" onClick={() => act(a, 'reopen')}>Reabrir</button>
                )}
                <button className="btn btn-small btn-danger" onClick={() => handleDelete(a)}>Eliminar</button>
              </td>
            </tr>
          ))}
          {alerts.length === 0 && (
            <tr><td colSpan="8" className="muted">No hay alertas {filter === 'open' ? 'abiertas' : filter === 'resolved' ? 'resueltas' : ''}.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
