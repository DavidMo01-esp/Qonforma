import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { productLabel } from '../format.js';

function todayLocal() {
  return new Date().toLocaleDateString('sv'); // YYYY-MM-DD
}

function nowHM() {
  return new Date().toTimeString().slice(0, 5); // HH:MM
}

function addDays(dateStr, delta) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString('sv');
}

export default function DailyLog() {
  const [date, setDate] = useState(todayLocal());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState(''); // '' | 'saving' | 'saved'
  const [newProductId, setNewProductId] = useState('');
  const [newBatch, setNewBatch] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [selectedLine, setSelectedLine] = useState('');
  const [extraLines, setExtraLines] = useState([]); // lines created this session with no samples yet
  const [lotSearch, setLotSearch] = useState('');
  const [flashKey, setFlashKey] = useState(''); // lot block to scroll to and highlight

  async function load() {
    const d = await api(`/daily?date=${date}`);
    setData(d);
    setNewProductId((prev) => prev || String(d.products[0]?.id ?? ''));
  }

  useEffect(() => {
    setData(null);
    setExtraLines([]);
    setSelectedLine('');
    load().catch((e) => setError(e.message));
  }, [date]);

  const productsById = useMemo(() => {
    if (!data) return {};
    return Object.fromEntries(data.products.map((p) => [p.id, p]));
  }, [data]);

  // Rows grouped by product + batch; the server returns samples time-ordered,
  // so groups appear in the order their first sample was taken.
  const groups = useMemo(() => {
    if (!data) return [];
    const map = new Map();
    for (const s of data.samples) {
      const key = `${s.product_id}|${s.batch}`;
      if (!map.has(key)) {
        map.set(key, { key, product_id: s.product_id, batch: s.batch, samples: [] });
      }
      map.get(key).samples.push(s);
    }
    return [...map.values()];
  }, [data]);

  // Line tabs: lines present in the day's data plus the ones created this session
  const linesInData = useMemo(
    () => [...new Set(groups.map((g) => g.samples[0]?.line || ''))],
    [groups]
  );
  const displayLines = useMemo(() => {
    const named = [...new Set([...linesInData.filter((l) => l !== ''), ...extraLines])].sort((a, b) =>
      a.localeCompare(b, 'es', { numeric: true })
    );
    const all = linesInData.includes('') ? [...named, ''] : named;
    return all.length > 0 ? all : ['1'];
  }, [linesInData, extraLines]);
  const activeLine = displayLines.includes(selectedLine) ? selectedLine : displayLines[0];

  const sampleCountByLine = useMemo(() => {
    const counts = {};
    for (const g of groups) {
      const l = g.samples[0]?.line || '';
      counts[l] = (counts[l] || 0) + g.samples.length;
    }
    return counts;
  }, [groups]);

  const visibleGroups = groups.filter((g) => (g.samples[0]?.line || '') === activeLine);
  const visibleSamples = visibleGroups.flatMap((g) => g.samples);

  // Finds a lot anywhere in the day, jumps to its line tab and highlights its block
  function searchLot(e) {
    e.preventDefault();
    const q = lotSearch.trim().toLowerCase();
    if (!q) return;
    const group = groups.find((g) => g.batch.toLowerCase().includes(q));
    if (!group) {
      setError(`No hay ningún lote «${lotSearch.trim()}» en este día`);
      return;
    }
    setError('');
    setSelectedLine(group.samples[0]?.line || '');
    setFlashKey(group.key);
  }

  useEffect(() => {
    if (!flashKey) return;
    const el = document.getElementById(`lote-${flashKey}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setFlashKey(''), 2500);
    return () => clearTimeout(t);
  }, [flashKey, activeLine]);

  function addLine() {
    const numeric = displayLines.map((l) => parseInt(l, 10)).filter((n) => !Number.isNaN(n));
    const suggestion = String((numeric.length ? Math.max(...numeric) : 0) + 1);
    const name = prompt('Nombre de la nueva línea', suggestion);
    if (!name || !name.trim()) return;
    const value = name.trim();
    if (!displayLines.includes(value)) setExtraLines((prev) => [...prev, value]);
    setSelectedLine(value);
  }

  function updateSample(sampleId, updater) {
    setData((d) => ({
      ...d,
      samples: d.samples.map((s) => (s.id === sampleId ? updater(s) : s)),
    }));
  }

  async function withSaving(fn) {
    setError('');
    setSaveState('saving');
    try {
      await fn();
      setSaveState('saved');
      setTimeout(() => setSaveState(''), 1500);
    } catch (err) {
      setSaveState('');
      setError(err.message);
    }
  }

  async function addSample(productId, batch, container, expiry, line) {
    await withSaving(async () => {
      await api('/samples', {
        method: 'POST',
        body: {
          product_id: Number(productId),
          batch,
          container,
          expiry_date: expiry || '',
          line: line || '',
          received_at: `${date} ${nowHM()}`,
        },
      });
      await load();
    });
  }

  async function deleteRow(sample) {
    if (!confirm(`¿Eliminar la muestra del envase ${sample.container || '?'} (lote ${sample.batch || 'sin lote'}) con todos sus resultados?`)) return;
    await withSaving(async () => {
      await api(`/samples/${sample.id}`, { method: 'DELETE' });
      setData((d) => ({ ...d, samples: d.samples.filter((s) => s.id !== sample.id) }));
    });
  }

  function sampleBody(sample, overrides = {}) {
    return {
      code: sample.code,
      container: sample.container,
      product_id: sample.product_id,
      batch: sample.batch,
      expiry_date: sample.expiry_date,
      line: sample.line,
      description: sample.description,
      status: sample.status,
      ...overrides,
    };
  }

  async function saveContainer(sample, raw) {
    const value = raw.trim();
    if (value === sample.container) return;
    await withSaving(async () => {
      const updated = await api(`/samples/${sample.id}`, {
        method: 'PUT',
        body: sampleBody(sample, { container: value }),
      });
      updateSample(sample.id, (s) => ({ ...s, container: updated.container }));
    });
  }

  async function saveTime(sample, raw) {
    if (!raw || raw === sample.received_at.slice(11, 16)) return;
    await withSaving(async () => {
      await api(`/samples/${sample.id}`, {
        method: 'PUT',
        body: sampleBody(sample, { received_at: `${date} ${raw}` }),
      });
      await load(); // reload to keep rows ordered by time
    });
  }

  async function renameBatch(group, raw) {
    const value = raw.trim();
    if (value === group.batch) return;
    await withSaving(async () => {
      for (const s of group.samples) {
        await api(`/samples/${s.id}`, { method: 'PUT', body: sampleBody(s, { batch: value }) });
      }
      await load();
    });
  }

  async function changeGroupProduct(group, newPid) {
    const pid = Number(newPid);
    if (pid === group.product_id) return;
    const hasResults = group.samples.some((s) => Object.keys(s.results).length > 0);
    if (
      hasResults &&
      !confirm(
        'Este lote ya tiene resultados. Se conservarán los análisis que también existan en el nuevo producto (re-evaluados con sus rangos) y se eliminarán los demás. ¿Continuar?'
      )
    ) {
      return;
    }
    await withSaving(async () => {
      for (const s of group.samples) {
        await api(`/samples/${s.id}`, { method: 'PUT', body: sampleBody(s, { product_id: pid }) });
      }
      await load();
    });
  }

  // Expiry belongs to the whole lot: updating it writes it to every sample of the group
  async function saveGroupExpiry(group, raw) {
    if (raw === (group.samples[0]?.expiry_date || '')) return;
    await withSaving(async () => {
      for (const s of group.samples) {
        await api(`/samples/${s.id}`, { method: 'PUT', body: sampleBody(s, { expiry_date: raw }) });
      }
      await load();
    });
  }

  // Renames the active line: rewrites the line on every sample of the day in it
  async function renameLine() {
    const name = prompt(
      activeLine ? 'Nuevo nombre de la línea' : 'Asignar estas muestras a la línea…',
      activeLine
    );
    if (name == null) return;
    const value = name.trim();
    if (!value || value === activeLine) return;
    if (visibleSamples.length === 0) {
      setExtraLines((prev) => [...prev.filter((l) => l !== activeLine && l !== value), value]);
      setSelectedLine(value);
      return;
    }
    await withSaving(async () => {
      for (const s of visibleSamples) {
        await api(`/samples/${s.id}`, { method: 'PUT', body: sampleBody(s, { line: value }) });
      }
      setExtraLines((prev) => prev.filter((l) => l !== activeLine));
      setSelectedLine(value);
      await load();
    });
  }

  // Deletes a whole lot: every sample of the group with its results and alerts
  async function deleteGroup(group) {
    const label = group.batch ? `el lote ${group.batch}` : 'este lote sin nombre';
    if (
      !confirm(
        `¿Eliminar ${label} de este día? Se borrarán sus ${group.samples.length} muestra${group.samples.length !== 1 ? 's' : ''} con todos sus resultados y alertas.`
      )
    ) {
      return;
    }
    await withSaving(async () => {
      for (const s of group.samples) {
        await api(`/samples/${s.id}`, { method: 'DELETE' });
      }
      await load();
    });
  }

  async function deleteLine() {
    const label = activeLine ? `la línea ${activeLine}` : 'la pestaña «Sin línea»';
    if (visibleSamples.length === 0) {
      setExtraLines((prev) => prev.filter((l) => l !== activeLine));
      setSelectedLine('');
      return;
    }
    if (
      !confirm(
        `¿Eliminar ${label} de este día? Se borrarán sus ${visibleSamples.length} muestra${visibleSamples.length !== 1 ? 's' : ''} con todos sus resultados y alertas.`
      )
    ) {
      return;
    }
    await withSaving(async () => {
      for (const s of visibleSamples) {
        await api(`/samples/${s.id}`, { method: 'DELETE' });
      }
      setExtraLines((prev) => prev.filter((l) => l !== activeLine));
      setSelectedLine('');
      await load();
    });
  }

  async function saveCell(sample, spec, raw) {
    const existing = sample.results[spec.id];
    const value = raw.trim();

    if (value === '') {
      if (!existing) return;
      await withSaving(async () => {
        await api(`/results/${existing.id}`, { method: 'DELETE' });
        updateSample(sample.id, (s) => {
          const results = { ...s.results };
          delete results[spec.id];
          return { ...s, results };
        });
      });
      return;
    }

    const num = Number(value);
    if (Number.isNaN(num)) {
      setError('El valor debe ser numérico');
      return;
    }
    if (existing && num === existing.value) return;

    await withSaving(async () => {
      const body = { sample_id: sample.id, specification_id: spec.id, value: num };
      const result = existing
        ? await api(`/results/${existing.id}`, { method: 'PUT', body })
        : await api('/results', { method: 'POST', body });
      updateSample(sample.id, (s) => ({
        ...s,
        status: s.status === 'pending' ? 'in_analysis' : s.status,
        results: { ...s.results, [spec.id]: result },
      }));
    });
  }

  function handleKeyDown(e, rowIndex, colKey) {
    const delta = e.key === 'Enter' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (delta === 0) return;
    e.preventDefault();
    e.target.blur();
    const next = document.querySelector(`[data-cell="${rowIndex + delta}:${colKey}"]`);
    if (next) next.focus();
  }

  const outOfSpecCount = visibleSamples.reduce(
    (acc, s) => acc + Object.values(s.results).filter((r) => r.status === 'out_of_spec').length,
    0
  );

  const prettyDate = new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (data && data.products.length === 0) {
    return (
      <div>
        <h1>Registro diario</h1>
        <div className="empty-state card">
          <h2>Aún no hay productos</h2>
          <p className="muted">
            Para empezar, <Link to="/products">crea un producto</Link> y define las especificaciones de sus análisis.
          </p>
        </div>
      </div>
    );
  }

  let rowIndex = -1; // global row counter for keyboard navigation

  return (
    <div>
      <div className="page-head daily-head">
        <div>
          <h1>Registro diario</h1>
          <p className="muted date-caption">{prettyDate}</p>
        </div>
        <div className="daily-right">
          <span className={`save-state ${saveState}`}>
            {saveState === 'saving' ? 'Guardando…' : saveState === 'saved' ? '✔ Guardado' : ''}
          </span>
          <div className="date-nav">
            <button className="btn" title="Día anterior" onClick={() => setDate(addDays(date, -1))}>‹</button>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <button className="btn" title="Día siguiente" onClick={() => setDate(addDays(date, 1))}>›</button>
            {date !== todayLocal() && (
              <button className="btn" onClick={() => setDate(todayLocal())}>Hoy</button>
            )}
          </div>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {!data ? (
        <p className="muted">Cargando…</p>
      ) : (
        <>
          <div className="line-tabs">
            {displayLines.map((line) => (
              <button
                key={line || 'no-line'}
                className={`line-tab ${line === activeLine ? 'active' : ''}`}
                onClick={() => setSelectedLine(line)}
              >
                {line ? `Línea ${line}` : 'Sin línea'}
                {(sampleCountByLine[line] || 0) > 0 && (
                  <span className="line-tab-count">{sampleCountByLine[line]}</span>
                )}
              </button>
            ))}
            <button className="line-tab line-tab-add" onClick={addLine} title="Crear otra línea de producción">
              + línea
            </button>
            <form className="lot-search" onSubmit={searchLot} title="Busca un lote en cualquier línea del día">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                placeholder="Buscar lote en el día…"
                value={lotSearch}
                onChange={(e) => setLotSearch(e.target.value)}
              />
            </form>
          </div>

          <div className="line-title">
            <h2>{activeLine ? `Línea ${activeLine}` : 'Sin línea'}</h2>
            <button
              className="btn btn-small"
              onClick={renameLine}
              title={activeLine ? 'Cambiar el nombre de la línea (se aplica a sus muestras del día)' : 'Asignar estas muestras a una línea'}
            >
              {activeLine ? 'Renombrar' : 'Asignar línea'}
            </button>
            <button
              className="btn btn-small btn-danger"
              onClick={deleteLine}
              title={visibleSamples.length > 0 ? 'Elimina la línea con sus muestras del día' : 'Quitar esta línea'}
            >
              Eliminar línea
            </button>
            {visibleSamples.length > 0 && (
              <div className="chip-row">
                {outOfSpecCount > 0 ? (
                  <span className="chip chip-danger"><strong>{outOfSpecCount}</strong> fuera de especificación</span>
                ) : (
                  <span className="chip chip-ok">Todo conforme</span>
                )}
              </div>
            )}
          </div>

          <div className="new-lote-bar card">
            <label>
              Producto
              <select value={newProductId} onChange={(e) => setNewProductId(e.target.value)}>
                {data.products.map((p) => (
                  <option key={p.id} value={p.id}>{productLabel(p)}</option>
                ))}
              </select>
            </label>
            <label>
              Lote
              <input
                placeholder="L-2026-001"
                value={newBatch}
                onChange={(e) => setNewBatch(e.target.value)}
              />
            </label>
            <label>
              Caducidad
              <input type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} />
            </label>
            <button
              className="btn btn-primary"
              onClick={() => addSample(newProductId, newBatch.trim(), '1', newExpiry, activeLine)}
              disabled={!newProductId}
            >
              + Añadir producto a {activeLine ? `línea ${activeLine}` : 'la hoja'}
            </button>
            <span className="muted new-lote-hint">
              Para más muestras de un lote ya en marcha, usa «+ muestra» en su bloque.
            </span>
          </div>

          {visibleGroups.length === 0 ? (
            <div className="empty-state card">
              <h2>{activeLine ? `Nada en la línea ${activeLine} este día` : 'No hay muestras sin línea'}</h2>
              <p className="muted">Elige producto y lote arriba para empezar a registrar en esta línea.</p>
            </div>
          ) : (
            visibleGroups.map((group) => {
              const product = productsById[group.product_id];
              const specs = product?.specifications || [];
              const groupOut = group.samples.reduce(
                (acc, s) => acc + Object.values(s.results).filter((r) => r.status === 'out_of_spec').length,
                0
              );
              return (
                <section
                  key={group.key}
                  id={`lote-${group.key}`}
                  className={`group-card ${flashKey === group.key ? 'group-flash' : ''}`}
                >
                  <header className="group-card-head">
                    <select
                      className="group-product"
                      value={group.product_id}
                      onChange={(e) => changeGroupProduct(group, e.target.value)}
                      title="Producto del lote (cambiarlo afecta a todas sus muestras)"
                    >
                      {data.products.map((p) => (
                        <option key={p.id} value={p.id}>{productLabel(p)}</option>
                      ))}
                    </select>
                    <span className="lote-tag">
                      Lote
                      <input
                        key={`${group.key}-batch`}
                        className="group-batch"
                        defaultValue={group.batch}
                        placeholder="sin lote"
                        onBlur={(e) => renameBatch(group, e.target.value)}
                        title="Lote (renombrarlo afecta a todas sus muestras)"
                      />
                    </span>
                    <span className="lote-tag">
                      Cad.
                      <input
                        key={`${group.key}-expiry-${group.samples[0]?.expiry_date || ''}`}
                        type="date"
                        className="group-expiry"
                        defaultValue={group.samples[0]?.expiry_date || ''}
                        onBlur={(e) => saveGroupExpiry(group, e.target.value)}
                        title="Fecha de caducidad del lote (se aplica a todas sus muestras)"
                      />
                    </span>
                    {groupOut > 0 && <span className="badge badge-alert">{groupOut} fuera</span>}
                    <span className="group-spacer" />
                    <button
                      className="btn btn-small btn-add"
                      onClick={() =>
                        addSample(
                          group.product_id,
                          group.batch,
                          String(group.samples.length + 1),
                          group.samples[0]?.expiry_date || '',
                          group.samples[0]?.line || ''
                        )
                      }
                      title="Añadir la siguiente muestra de este lote (hora actual)"
                    >
                      + muestra
                    </button>
                    <button
                      className="btn btn-small btn-danger"
                      onClick={() => deleteGroup(group)}
                      title="Eliminar el lote completo con sus muestras"
                    >
                      Eliminar lote
                    </button>
                  </header>

                  {specs.length === 0 ? (
                    <p className="muted group-empty">
                      Este producto no tiene especificaciones.{' '}
                      <Link to={`/products/${group.product_id}`}>Añádelas aquí</Link> para poder registrar valores.
                    </p>
                  ) : (
                    <div className="table-scroll">
                      <table className="table table-daily">
                        <thead>
                          <tr>
                            <th className="row-num">#</th>
                            <th className="col-time">Hora</th>
                            <th className="col-container">Envase</th>
                            <th className="col-prod">Producto</th>
                            <th className="col-lot">Lote / Caducidad</th>
                            {specs.map((sp) => (
                              <th key={sp.id}>
                                {sp.parameter} {sp.unit && <span className="muted">({sp.unit})</span>}
                                <span className="spec-range">
                                  {sp.min_value ?? '−∞'} – {sp.max_value ?? '+∞'}
                                </span>
                              </th>
                            ))}
                            <th>Estado</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.samples.map((sample, si) => {
                            rowIndex++;
                            const r = rowIndex;
                            const values = Object.values(sample.results);
                            const hasOut = values.some((res) => res.status === 'out_of_spec');
                            const complete = specs.length > 0 && specs.every((sp) => sample.results[sp.id]);
                            return (
                              <tr key={sample.id}>
                                <td className="row-num">{si + 1}</td>
                                <td className="cell-input col-time">
                                  <input
                                    key={`${sample.id}-time-${sample.received_at}`}
                                    type="time"
                                    defaultValue={sample.received_at.slice(11, 16)}
                                    data-cell={`${r}:time`}
                                    onBlur={(e) => saveTime(sample, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, r, 'time')}
                                  />
                                </td>
                                <td className="cell-input col-container">
                                  <input
                                    key={`${sample.id}-container-${sample.container}`}
                                    defaultValue={sample.container}
                                    placeholder="nº envase"
                                    data-cell={`${r}:container`}
                                    onBlur={(e) => saveContainer(sample, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, r, 'container')}
                                  />
                                </td>
                                <td className="col-prod">
                                  <div className="prod-name">{product?.name}</div>
                                  {product?.code && <div className="prod-code">#{product.code}</div>}
                                </td>
                                <td className="col-lot">
                                  <div className="lot-name">{sample.batch || '—'}</div>
                                  <div className="lot-expiry" title="Fecha de caducidad del lote (se edita en la cabecera)">
                                    {sample.expiry_date
                                      ? sample.expiry_date.split('-').reverse().join('/')
                                      : 'sin caducidad'}
                                  </div>
                                </td>
                                {specs.map((sp) => {
                                  const result = sample.results[sp.id];
                                  const out = result?.status === 'out_of_spec';
                                  const range = `${sp.min_value ?? '−∞'} – ${sp.max_value ?? '+∞'}${sp.unit ? ' ' + sp.unit : ''}`;
                                  return (
                                    <td key={sp.id} className={`cell-input ${out ? 'cell-out' : ''}`}>
                                      <input
                                        key={`${sample.id}-${sp.id}-${result?.value ?? ''}`}
                                        type="number"
                                        step="any"
                                        defaultValue={result?.value ?? ''}
                                        data-cell={`${r}:${sp.parameter}`}
                                        title={out ? `Fuera de especificación (${range})` : range}
                                        onBlur={(e) => saveCell(sample, sp, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, r, sp.parameter)}
                                      />
                                    </td>
                                  );
                                })}
                                <td className="col-status">
                                  {hasOut ? (
                                    <span className="badge badge-alert">Fuera</span>
                                  ) : values.length === 0 ? (
                                    <span className="muted">—</span>
                                  ) : complete ? (
                                    <span className="badge badge-ok">Completa</span>
                                  ) : (
                                    <span className="badge badge-in_analysis">Parcial</span>
                                  )}
                                </td>
                                <td className="row-actions">
                                  <Link className="btn btn-small" to={`/samples/${sample.id}`}>Ver</Link>
                                  <button
                                    className="btn btn-small btn-danger"
                                    title="Eliminar muestra"
                                    onClick={() => deleteRow(sample)}
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="avg-row">
                            <td colSpan={5} className="avg-label">Media del lote</td>
                            {specs.map((sp) => {
                              const vals = group.samples
                                .map((s) => s.results[sp.id]?.value)
                                .filter((v) => v != null);
                              if (vals.length === 0) {
                                return <td key={sp.id} className="avg-cell muted">—</td>;
                              }
                              const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                              const out =
                                (sp.min_value != null && avg < sp.min_value) ||
                                (sp.max_value != null && avg > sp.max_value);
                              return (
                                <td
                                  key={sp.id}
                                  className={`avg-cell ${out ? 'avg-out' : ''}`}
                                  title={`Media de ${vals.length} resultado${vals.length !== 1 ? 's' : ''}${out ? ' — fuera de especificación' : ''}`}
                                >
                                  {Number(avg.toFixed(2))}
                                </td>
                              );
                            })}
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </section>
              );
            })
          )}

          {visibleSamples.length > 0 && (
            <p className="muted hint">
              Los valores se guardan solos al salir de la celda; Enter o ↓/↑ recorren la columna. Pasa el ratón por
              una celda para ver su rango. Las celdas rojas están fuera de especificación y generan alerta.
            </p>
          )}
        </>
      )}
    </div>
  );
}
