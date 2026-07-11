import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { productLabel } from '../format.js';

const STATUS_LABELS = {
  pending: 'Pendiente',
  in_analysis: 'En análisis',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

const EMPTY = { code: '', container: '', product_id: '', batch: '', expiry_date: '', line: '', description: '', status: 'pending' };

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status] || status}</span>;
}

export default function Samples() {
  const [samples, setSamples] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    if (search) params.set('q', search);
    setSamples(await api(`/samples?${params}`));
  }

  useEffect(() => {
    api('/products').then(setProducts).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [filter, search]);

  function startCreate() {
    setForm(EMPTY);
    setEditingId(null);
    setShowForm(true);
    setError('');
  }

  function startEdit(sample) {
    setForm({
      code: sample.code,
      container: sample.container,
      product_id: sample.product_id,
      batch: sample.batch,
      expiry_date: sample.expiry_date,
      line: sample.line,
      description: sample.description,
      status: sample.status,
    });
    setEditingId(sample.id);
    setShowForm(true);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await api(`/samples/${editingId}`, { method: 'PUT', body: form });
      } else {
        await api('/samples', { method: 'POST', body: form });
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(sample) {
    if (!confirm(`¿Eliminar la muestra ${sample.code}? Se borrarán también sus resultados y alertas.`)) return;
    try {
      await api(`/samples/${sample.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Muestras</h1>
          <p className="muted page-sub">Histórico completo de muestras de todos los días</p>
        </div>
        <button className="btn btn-primary" onClick={startCreate}>+ Nueva muestra</button>
      </div>

      <div className="filters">
        <input placeholder="Buscar por código, producto o lote…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {showForm && products.length === 0 && (
        <div className="alert-error">
          Primero <Link to="/products">crea un producto</Link> para poder registrar muestras.
        </div>
      )}

      {showForm && products.length > 0 && (
        <form className="card form-card" onSubmit={handleSubmit}>
          <h2>{editingId ? 'Editar muestra' : 'Nueva muestra'}</h2>
          <div className="form-grid">
            <label>
              Código *
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            </label>
            <label>
              Producto *
              <select
                value={form.product_id}
                onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                required
              >
                <option value="">— Selecciona —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{productLabel(p)}</option>
                ))}
              </select>
            </label>
            <label>
              Lote
              <input value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })} />
            </label>
            <label>
              Envase (nº)
              <input value={form.container} onChange={(e) => setForm({ ...form, container: e.target.value })} />
            </label>
            <label>
              Fecha de caducidad
              <input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
            </label>
            <label>
              Línea de producción
              <input value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })} />
            </label>
            <label>
              Estado
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="span-2">
              Descripción
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary">{editingId ? 'Guardar cambios' : 'Crear'}</button>
          </div>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Producto</th>
            <th>Lote</th>
            <th>Envase</th>
            <th>Estado</th>
            <th>Resultados</th>
            <th>Alertas</th>
            <th>Recibida</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {samples.map((s) => (
            <tr key={s.id}>
              <td><Link to={`/samples/${s.id}`}>{s.code}</Link></td>
              <td>{productLabel({ code: s.product_code, name: s.product_name })}</td>
              <td>{s.batch || '—'}</td>
              <td>{s.container || '—'}</td>
              <td><StatusBadge status={s.status} /></td>
              <td>{s.result_count}</td>
              <td>{s.open_alerts > 0 ? <span className="badge badge-alert">⚠ {s.open_alerts}</span> : '—'}</td>
              <td>{s.received_at}</td>
              <td className="row-actions">
                <button className="btn btn-small" onClick={() => startEdit(s)}>Editar</button>
                <button className="btn btn-small btn-danger" onClick={() => handleDelete(s)}>Eliminar</button>
              </td>
            </tr>
          ))}
          {samples.length === 0 && (
            <tr><td colSpan="9" className="muted">No hay muestras registradas.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
