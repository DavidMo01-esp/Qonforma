import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, getStoredUser } from '../api.js';

const EMPTY = { parameter: '', unit: '', min_value: '', max_value: '' };

// Small-multiple line chart: one parameter over time, spec band as reference
function TrendChart({ spec, points }) {
  const W = 640;
  const H = 170;
  const PAD = { l: 46, r: 14, t: 14, b: 26 };
  const values = points.map((p) => p.value);
  let lo = Math.min(...values, spec.min_value ?? Infinity);
  let hi = Math.max(...values, spec.max_value ?? -Infinity);
  if (!Number.isFinite(lo)) lo = Math.min(...values);
  if (!Number.isFinite(hi)) hi = Math.max(...values);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const margin = (hi - lo) * 0.15;
  lo -= margin;
  hi += margin;

  const x = (i) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(points.length - 1, 1);
  const y = (v) => PAD.t + ((hi - v) * (H - PAD.t - PAD.b)) / (hi - lo);
  const fmt = (v) => Number(v.toFixed(2));

  const gridVals = [lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.75];
  const firstDate = points[0].analyzed_at.slice(5, 10).split('-').reverse().join('/');
  const lastDate = points[points.length - 1].analyzed_at.slice(5, 10).split('-').reverse().join('/');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend-chart" role="img" aria-label={`Tendencia de ${spec.parameter}`}>
      {/* acceptable zone between min and max */}
      {spec.min_value != null && spec.max_value != null && (
        <rect
          x={PAD.l}
          y={y(spec.max_value)}
          width={W - PAD.l - PAD.r}
          height={Math.max(y(spec.min_value) - y(spec.max_value), 0)}
          className="trend-band"
        />
      )}
      {gridVals.map((v) => (
        <line key={v} x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="trend-grid-line" />
      ))}
      {[spec.min_value, spec.max_value]
        .filter((v) => v != null)
        .map((v) => (
          <g key={`lim-${v}`}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="trend-limit" />
            <text x={PAD.l - 6} y={y(v) + 3.5} className="trend-tick" textAnchor="end">{fmt(v)}</text>
          </g>
        ))}
      <polyline
        className="trend-line"
        points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
      />
      {points.map((p, i) => {
        const out = p.status === 'out_of_spec';
        return (
          <circle key={i} cx={x(i)} cy={y(p.value)} r="4" className={out ? 'trend-dot trend-dot-out' : 'trend-dot'}>
            <title>
              {`${p.value}${spec.unit ? ' ' + spec.unit : ''} — ${p.analyzed_at.slice(0, 16).replace('T', ' ')} · lote ${p.batch || 'sin lote'}${out ? ' · FUERA DE ESPECIFICACIÓN' : ''}`}
            </title>
          </circle>
        );
      })}
      <text x={PAD.l} y={H - 8} className="trend-tick">{firstDate}</text>
      <text x={W - PAD.r} y={H - 8} className="trend-tick" textAnchor="end">{lastDate}</text>
    </svg>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [trendRows, setTrendRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const isAdmin = getStoredUser()?.role === 'admin';

  async function load() {
    const [p, t] = await Promise.all([api(`/products/${id}`), api(`/products/${id}/trends`)]);
    setProduct(p);
    setTrendRows(t);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [id]);

  const trendsBySpec = useMemo(() => {
    const map = {};
    for (const r of trendRows) {
      (map[r.specification_id] ||= []).push(r);
    }
    return map;
  }, [trendRows]);

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
        {isAdmin && (
          <button className="btn btn-primary" onClick={startCreate}>+ Añadir especificación</button>
        )}
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
            {isAdmin && <th></th>}
          </tr>
        </thead>
        <tbody>
          {product.specifications.map((sp) => (
            <tr key={sp.id}>
              <td>{sp.parameter}</td>
              <td>{sp.min_value ?? '—'}</td>
              <td>{sp.max_value ?? '—'}</td>
              <td>{sp.unit || '—'}</td>
              {isAdmin && (
                <td className="row-actions">
                  <button className="btn btn-small" onClick={() => startEdit(sp)}>Editar</button>
                  <button className="btn btn-small btn-danger" onClick={() => handleDelete(sp)}>Eliminar</button>
                </td>
              )}
            </tr>
          ))}
          {product.specifications.length === 0 && (
            <tr>
              <td colSpan={isAdmin ? 5 : 4} className="muted">
                Este producto aún no tiene especificaciones.
                {isAdmin ? ' Añade la primera con el botón de arriba.' : ' Pide a un administrador que las defina.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2>Tendencias</h2>
      {product.specifications.every((sp) => (trendsBySpec[sp.id] || []).length < 2) ? (
        <p className="muted">
          Cuando haya al menos dos resultados de un parámetro, aquí verás su evolución en el tiempo
          con la zona de especificación marcada.
        </p>
      ) : (
        <div className="trend-grid">
          {product.specifications.map((sp) => {
            const pts = trendsBySpec[sp.id] || [];
            if (pts.length < 2) return null;
            const outCount = pts.filter((p) => p.status === 'out_of_spec').length;
            return (
              <div key={sp.id} className="card trend-card">
                <div className="trend-head">
                  <strong>{sp.parameter}</strong> {sp.unit && <span className="muted">({sp.unit})</span>}
                  <span className="muted trend-count">
                    {pts.length} resultado{pts.length !== 1 ? 's' : ''}
                    {outCount > 0 && <span className="day-out"> · ⚠ {outCount} fuera</span>}
                  </span>
                </div>
                <TrendChart spec={sp} points={pts} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
