import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';

const EMPTY = { parameter: '', unit: '', min_value: '', max_value: '' };

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setProduct(await api(`/products/${id}`));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [id]);

  function startCreate() {
    setForm(EMPTY);
    setEditingId(null);
    setShowForm(true);
    setError('');
  }

  function startEdit(spec) {
    setForm({
      parameter: spec.parameter,
      unit: spec.unit,
      min_value: spec.min_value ?? '',
      max_value: spec.max_value ?? '',
    });
    setEditingId(spec.id);
    setShowForm(true);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const body = { ...form, product_id: Number(id) };
    try {
      if (editingId) {
        await api(`/specifications/${editingId}`, { method: 'PUT', body });
      } else {
        await api('/specifications', { method: 'POST', body });
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(spec) {
    if (!confirm(`¿Eliminar la especificación "${spec.parameter}"? Se borrarán los resultados asociados.`)) return;
    try {
      await api(`/specifications/${spec.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!product) return error ? <div className="alert-error">{error}</div> : <p className="muted">Cargando…</p>;

  return (
    <div>
      <p><Link to="/products">← Volver a productos</Link></p>
      <div className="page-head">
        <h1>
          {product.code && <span className="muted">{product.code} · </span>}
          {product.name}
        </h1>
        <button className="btn btn-primary" onClick={startCreate}>+ Añadir especificación</button>
      </div>
      {product.description && <p className="muted">{product.description}</p>}

      {error && <div className="alert-error">{error}</div>}

      {showForm && (
        <form className="card form-card" onSubmit={handleSubmit}>
          <h2>{editingId ? 'Editar especificación' : 'Nueva especificación'}</h2>
          <div className="form-grid">
            <label>
              Parámetro / análisis *
              <input
                placeholder="pH, Humedad, Viscosidad…"
                value={form.parameter}
                onChange={(e) => setForm({ ...form, parameter: e.target.value })}
                autoFocus
                required
              />
            </label>
            <label>
              Unidad
              <input placeholder="%, mg/L, cP…" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </label>
            <label>
              Mínimo
              <input type="number" step="any" value={form.min_value} onChange={(e) => setForm({ ...form, min_value: e.target.value })} />
            </label>
            <label>
              Máximo
              <input type="number" step="any" value={form.max_value} onChange={(e) => setForm({ ...form, max_value: e.target.value })} />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary">{editingId ? 'Guardar cambios' : 'Añadir'}</button>
          </div>
        </form>
      )}

      <h2>Especificaciones de análisis</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Parámetro</th>
            <th>Mínimo</th>
            <th>Máximo</th>
            <th>Unidad</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {product.specifications.map((sp) => (
            <tr key={sp.id}>
              <td>{sp.parameter}</td>
              <td>{sp.min_value ?? '—'}</td>
              <td>{sp.max_value ?? '—'}</td>
              <td>{sp.unit || '—'}</td>
              <td className="row-actions">
                <button className="btn btn-small" onClick={() => startEdit(sp)}>Editar</button>
                <button className="btn btn-small btn-danger" onClick={() => handleDelete(sp)}>Eliminar</button>
              </td>
            </tr>
          ))}
          {product.specifications.length === 0 && (
            <tr><td colSpan="5" className="muted">Este producto aún no tiene especificaciones. Añade la primera con el botón de arriba.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
