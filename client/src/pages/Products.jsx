import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const EMPTY = { code: '', name: '', description: '' };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setProducts(await api('/products'));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  function startCreate() {
    setForm(EMPTY);
    setEditingId(null);
    setShowForm(true);
    setError('');
  }

  function startEdit(product) {
    setForm({ code: product.code, name: product.name, description: product.description });
    setEditingId(product.id);
    setShowForm(true);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await api(`/products/${editingId}`, { method: 'PUT', body: form });
      } else {
        await api('/products', { method: 'POST', body: form });
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(product) {
    if (!confirm(`¿Eliminar el producto "${product.name}"? Se borrarán también sus especificaciones, muestras y alertas.`)) return;
    try {
      await api(`/products/${product.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Productos</h1>
          <p className="muted page-sub">Catálogo de artículos y sus especificaciones de análisis</p>
        </div>
        <button className="btn btn-primary" onClick={startCreate}>+ Crear producto</button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {showForm && (
        <form className="card form-card" onSubmit={handleSubmit}>
          <h2>{editingId ? 'Editar producto' : 'Nuevo producto'}</h2>
          <div className="form-grid">
            <label>
              Código (NP)
              <input
                placeholder="NP-0001"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                autoFocus
              />
            </label>
            <label>
              Nombre *
              <input
                placeholder="Zumo de naranja, Crema hidratante…"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
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
            <th>Descripción</th>
            <th>Especificaciones</th>
            <th>Muestras</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>{p.code || '—'}</td>
              <td><Link to={`/products/${p.id}`}><strong>{p.name}</strong></Link></td>
              <td>{p.description || '—'}</td>
              <td>{p.spec_count}</td>
              <td>{p.sample_count}</td>
              <td className="row-actions">
                <Link className="btn btn-small" to={`/products/${p.id}`}>Especificaciones</Link>
                <button className="btn btn-small" onClick={() => startEdit(p)}>Editar</button>
                <button className="btn btn-small btn-danger" onClick={() => handleDelete(p)}>Eliminar</button>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr><td colSpan="6" className="muted">Aún no hay productos. Crea el primero con el botón de arriba.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
