import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { productColor } from '../format.js';

export default function Lot() {
  const { batch } = useParams();
  const [lot, setLot] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setLot(null);
    api(`/lots/${encodeURIComponent(batch)}`)
      .then(setLot)
      .catch((e) => setError(e.message));
  }, [batch]);

  if (error) return <div><div className="alert-error">{error}</div><Link to="/">← Volver al registro diario</Link></div>;
  if (!lot) return <p className="muted">Cargando…</p>;

  const specs = lot.specifications;
  const openAlerts = lot.alerts.filter((a) => a.status === 'open').length;
  const outCount = lot.samples.reduce(
    (acc, s) => acc + s.results.filter((r) => r.status === 'out_of_spec').length,
    0
  );
  const resultFor = (sample, spec) => sample.results.find((r) => r.specification_id === spec.id);

  return (
    <div>
      <p><Link to="/">← Volver al registro diario</Link></p>
      <div className="page-head">
        <div className="lot-head">
          <span className="prod-avatar" style={{ background: productColor(lot.product.name) }}>
            {lot.product.name[0].toUpperCase()}
          </span>
          <div>
            <h1>Lote <span className="lot-link">{lot.batch}</span></h1>
            <p className="muted page-sub">
              <Link to={`/products/${lot.product.id}`}>
                {lot.product.code ? `${lot.product.code} — ` : ''}{lot.product.name}
              </Link>
              {lot.expiry_date && <> · caduca el {lot.expiry_date.split('-').reverse().join('/')}</>}
              {lot.line && <> · línea {lot.line}</>}
            </p>
          </div>
        </div>
        <div className="chip-row">
          <span className="chip"><strong>{lot.samples.length}</strong> muestra{lot.samples.length !== 1 ? 's' : ''}</span>
          {outCount > 0 ? (
            <span className="chip chip-danger"><strong>{outCount}</strong> fuera de especificación</span>
          ) : (
            <span className="chip chip-ok">Todo conforme</span>
          )}
          {openAlerts > 0 && <span className="chip chip-danger"><strong>{openAlerts}</strong> alerta{openAlerts !== 1 ? 's' : ''} abierta{openAlerts !== 1 ? 's' : ''}</span>}
        </div>
      </div>

      <div className="table-scroll">
        <table className="table table-daily">
          <thead>
            <tr>
              <th className="row-num">#</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Envase</th>
              {specs.map((sp) => (
                <th key={sp.id}>
                  {sp.parameter} {sp.unit && <span className="muted">({sp.unit})</span>}
                  <span className="spec-range">{sp.min_value ?? '−∞'} – {sp.max_value ?? '+∞'}</span>
                </th>
              ))}
              <th>Analista</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lot.samples.map((s, i) => {
              const analysts = [...new Set(s.results.map((r) => r.analyzed_by_name).filter(Boolean))];
              return (
                <tr key={s.id}>
                  <td className="row-num">{i + 1}</td>
                  <td>{s.received_at.slice(0, 10).split('-').reverse().join('/')}</td>
                  <td>{s.received_at.slice(11, 16)}</td>
                  <td><strong>{s.container || '—'}</strong></td>
                  {specs.map((sp) => {
                    const r = resultFor(s, sp);
                    if (!r) return <td key={sp.id} className="muted">—</td>;
                    const out = r.status === 'out_of_spec';
                    return (
                      <td key={sp.id} className={out ? 'cell-out lot-value' : 'lot-value'}>
                        <strong>{r.value}</strong>
                      </td>
                    );
                  })}
                  <td className="muted">{analysts.join(', ') || '—'}</td>
                  <td className="row-actions">
                    <Link className="btn btn-small" to={`/samples/${s.id}`}>Ver</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="avg-row">
              <td colSpan={4} className="avg-label">Media del lote</td>
              {specs.map((sp) => {
                const vals = lot.samples
                  .map((s) => resultFor(s, sp)?.value)
                  .filter((v) => v != null);
                if (vals.length === 0) return <td key={sp.id} className="muted">—</td>;
                const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                const out =
                  (sp.min_value != null && avg < sp.min_value) ||
                  (sp.max_value != null && avg > sp.max_value);
                return (
                  <td key={sp.id} className={out ? 'avg-out' : ''}>
                    {Number(avg.toFixed(2))}
                  </td>
                );
              })}
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <h2>Alertas del lote</h2>
      {lot.alerts.length === 0 ? (
        <p className="muted">Este lote no ha generado ninguna alerta.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Mensaje</th>
              <th>Creada</th>
              <th>Resuelta</th>
            </tr>
          </thead>
          <tbody>
            {lot.alerts.map((a) => (
              <tr key={a.id} className={a.status === 'open' ? 'row-out-of-spec' : ''}>
                <td>
                  {a.status === 'open'
                    ? <span className="badge badge-alert">Abierta</span>
                    : <span className="badge badge-ok">Resuelta</span>}
                </td>
                <td>
                  {a.message}
                  {a.resolution_note && <div className="note-line">↳ {a.resolution_note}</div>}
                </td>
                <td>{a.created_at}</td>
                <td>{a.resolved_at ? `${a.resolved_at} (${a.resolved_by_name || '?'})` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
