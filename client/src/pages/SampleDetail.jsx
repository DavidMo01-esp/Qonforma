import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { StatusBadge } from './Samples.jsx';

const EMPTY = { specification_id: '', value: '', notes: '' };

export default function SampleDetail() {
  const { id } = useParams();
  const [sample, setSample] = useState(null);
  const [specs, setSpecs] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    const sampleData = await api(`/samples/${id}`);
    setSample(sampleData);
    setSpecs(await api(`/specifications?product_id=${sampleData.product_id}`));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const body = { ...form, sample_id: Number(id) };
    try {
      if (editingId) {
        await api(`/results/${editingId}`, { method: 'PUT', body });
      } else {
        await api('/results', { method: 'POST', body });
      }
      setForm(EMPTY);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(result) {
    setEditingId(result.id);
    setForm({ specification_id: result.specification_id, value: result.value, notes: result.notes });
  }

  async function handleDelete(result) {
    if (!confirm(`¿Eliminar el resultado de ${result.parameter}?`)) return;
    try {
      await api(`/results/${result.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!sample) return error ? <div className="alert-error">{error}</div> : <p className="muted">Cargando…</p>;

  return (
    <div>
      <p><Link to="/samples">← Volver a muestras</Link></p>
      <div className="page-head">
        <h1>Muestra {sample.code}</h1>
        <StatusBadge status={sample.status} />
      </div>

      <div className="card detail-card">
        <div>
          <strong>Producto:</strong>{' '}
          <Link to={`/products/${sample.product_id}`}>
            {sample.product_code ? `${sample.product_code} — ` : ''}{sample.product_name}
          </Link>
        </div>
        <div><strong>Lote:</strong> {sample.batch || '—'}</div>
        <div><strong>Envase:</strong> {sample.container || '—'}</div>
        <div><strong>Caducidad:</strong> {sample.expiry_date || '—'}</div>
        <div><strong>Línea:</strong> {sample.line || '—'}</div>
        <div><strong>Recibida:</strong> {sample.received_at}</div>
        <div><strong>Registrada por:</strong> {sample.created_by_name || '—'}</div>
        {sample.description && <div className="span-2"><strong>Descripción:</strong> {sample.description}</div>}
      </div>

      <h2>{editingId ? 'Editar resultado' : 'Añadir resultado de análisis'}</h2>
      {error && <div className="alert-error">{error}</div>}
      {specs.length === 0 ? (
        <p className="muted">
          El producto <Link to={`/products/${sample.product_id}`}>{sample.product_name}</Link> aún no tiene
          especificaciones definidas. Añádelas primero para poder registrar resultados.
        </p>
      ) : (
        <form className="card form-card" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Parámetro *
              <select
                value={form.specification_id}
                onChange={(e) => setForm({ ...form, specification_id: e.target.value })}
                required
              >
                <option value="">— Selecciona —</option>
                {specs.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.parameter} [{sp.min_value ?? '−∞'} – {sp.max_value ?? '+∞'} {sp.unit}]
                  </option>
                ))}
              </select>
            </label>
            <label>
              Valor *
              <input
                type="number"
                step="any"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                required
              />
            </label>
            <label className="span-2">
              Notas
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </div>
          <div className="form-actions">
            {editingId && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY);
                }}
              >
                Cancelar edición
              </button>
            )}
            <button className="btn btn-primary">{editingId ? 'Guardar cambios' : 'Registrar resultado'}</button>
          </div>
        </form>
      )}

      <h2>Resultados</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Parámetro</th>
            <th>Valor</th>
            <th>Especificación</th>
            <th>Estado</th>
            <th>Analista</th>
            <th>Fecha</th>
            <th>Notas</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sample.results.map((r) => (
            <tr key={r.id} className={r.status === 'out_of_spec' ? 'row-out-of-spec' : ''}>
              <td>{r.parameter}</td>
              <td><strong>{r.value}</strong> {r.unit}</td>
              <td>{r.min_value ?? '−∞'} – {r.max_value ?? '+∞'} {r.unit}</td>
              <td>
                {r.status === 'ok'
                  ? <span className="badge badge-ok">✔ Conforme</span>
                  : <span className="badge badge-alert">⚠ Fuera de espec.</span>}
              </td>
              <td>{r.analyzed_by_name || '—'}</td>
              <td>{r.analyzed_at}</td>
              <td>{r.notes || '—'}</td>
              <td className="row-actions">
                <button className="btn btn-small" onClick={() => startEdit(r)}>Editar</button>
                <button className="btn btn-small btn-danger" onClick={() => handleDelete(r)}>Eliminar</button>
              </td>
            </tr>
          ))}
          {sample.results.length === 0 && (
            <tr><td colSpan="8" className="muted">Aún no hay resultados para esta muestra.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
