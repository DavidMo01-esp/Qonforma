import { Router } from 'express';
import db from '../db.js';
import { evaluate, syncAlert } from '../evaluation.js';
import { isDayLocked, sampleDay, LOCKED_ERROR } from '../locks.js';

const router = Router();

const STATUSES = ['pending', 'in_analysis', 'approved', 'rejected'];

const SAMPLE_QUERY = `
  SELECT s.*, p.name AS product_name, p.code AS product_code, u.username AS created_by_name,
    (SELECT COUNT(*) FROM results r WHERE r.sample_id = s.id) AS result_count,
    (SELECT COUNT(*) FROM alerts a WHERE a.sample_id = s.id AND a.status = 'open') AS open_alerts
  FROM samples s
  JOIN products p ON p.id = s.product_id
  LEFT JOIN users u ON u.id = s.created_by
`;

function validate(body, { requireCode = true } = {}) {
  const { code, container, product_id, batch, description, status, received_at, expiry_date, line } = body || {};
  if (requireCode && (!code || !code.trim())) return { error: 'El código de muestra es obligatorio' };
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  if (!product) return { error: 'Selecciona un producto válido' };
  if (status && !STATUSES.includes(status)) return { error: 'Estado no válido' };
  if (expiry_date && !/^\d{4}-\d{2}-\d{2}$/.test(expiry_date)) {
    return { error: 'Fecha de caducidad no válida (formato YYYY-MM-DD)' };
  }
  let received = null;
  if (received_at) {
    const m = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?::\d{2})?)?$/.exec(received_at);
    if (!m) return { error: 'Fecha no válida (formato YYYY-MM-DD u YYYY-MM-DD HH:MM)' };
    received = `${m[1]} ${m[2] || '00:00'}:00`;
  }
  return {
    data: {
      code: (code || '').trim(),
      container: (container || '').trim(),
      product_id: product.id,
      batch: (batch || '').trim(),
      expiry_date: expiry_date || '',
      line: (line || '').trim(),
      description: (description || '').trim(),
      status: status || 'pending',
      received_at: received,
    },
  };
}

// Generates the next free code for a day, e.g. M-20260711-03
function generateCode(receivedAt) {
  const day = receivedAt ? receivedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const compact = day.replaceAll('-', '');
  let n = db.prepare('SELECT COUNT(*) AS n FROM samples WHERE date(received_at) = ?').get(day).n + 1;
  let code;
  do {
    code = `M-${compact}-${String(n).padStart(2, '0')}`;
    n++;
  } while (db.prepare('SELECT 1 FROM samples WHERE code = ?').get(code));
  return code;
}

router.get('/', (req, res) => {
  const { status, q, product_id, date } = req.query;
  let sql = SAMPLE_QUERY;
  const where = [];
  const params = [];
  if (status && STATUSES.includes(status)) {
    where.push('s.status = ?');
    params.push(status);
  }
  if (product_id) {
    where.push('s.product_id = ?');
    params.push(product_id);
  }
  if (date) {
    where.push('date(s.received_at) = ?');
    params.push(date);
  }
  if (q) {
    where.push('(s.code LIKE ? OR p.name LIKE ? OR p.code LIKE ? OR s.batch LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY s.received_at DESC, s.id DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const sample = db.prepare(SAMPLE_QUERY + ' WHERE s.id = ?').get(req.params.id);
  if (!sample) return res.status(404).json({ error: 'Muestra no encontrada' });
  const results = db
    .prepare(
      `SELECT r.*, sp.parameter, sp.unit, sp.min_value, sp.max_value, u.username AS analyzed_by_name
       FROM results r
       JOIN specifications sp ON sp.id = r.specification_id
       LEFT JOIN users u ON u.id = r.analyzed_by
       WHERE r.sample_id = ? ORDER BY r.analyzed_at DESC, r.id DESC`
    )
    .all(req.params.id);
  res.json({ ...sample, results });
});

router.post('/', (req, res) => {
  const { error, data } = validate(req.body, { requireCode: false });
  if (error) return res.status(400).json({ error });
  const targetDay = data.received_at ? sampleDay(data.received_at) : new Date().toISOString().slice(0, 10);
  if (isDayLocked(targetDay)) return res.status(403).json(LOCKED_ERROR);
  if (!data.code) data.code = generateCode(data.received_at);
  try {
    const info = db
      .prepare(
        `INSERT INTO samples (code, container, product_id, batch, expiry_date, line, description, status, created_by, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`
      )
      .run(data.code, data.container, data.product_id, data.batch, data.expiry_date, data.line, data.description, data.status, req.user.id, data.received_at);
    res.status(201).json(db.prepare(SAMPLE_QUERY + ' WHERE s.id = ?').get(info.lastInsertRowid));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe una muestra con ese código' });
    }
    throw e;
  }
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM samples WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Muestra no encontrada' });
  const { error, data } = validate(req.body);
  if (error) return res.status(400).json({ error });
  if (isDayLocked(sampleDay(existing.received_at))) return res.status(403).json(LOCKED_ERROR);
  if (data.received_at && isDayLocked(sampleDay(data.received_at))) return res.status(403).json(LOCKED_ERROR);
  try {
    db.prepare(
      'UPDATE samples SET code = ?, container = ?, product_id = ?, batch = ?, expiry_date = ?, line = ?, description = ?, status = ?, received_at = COALESCE(?, received_at) WHERE id = ?'
    ).run(data.code, data.container, data.product_id, data.batch, data.expiry_date, data.line, data.description, data.status, data.received_at, req.params.id);
    // If the product changed, remap results to the new product's specs by
    // parameter name (re-evaluating them); drop results with no equivalent.
    if (existing.product_id !== data.product_id) {
      const results = db
        .prepare(
          `SELECT r.*, sp.parameter FROM results r
           JOIN specifications sp ON sp.id = r.specification_id
           WHERE r.sample_id = ?`
        )
        .all(req.params.id);
      const findSpec = db.prepare('SELECT * FROM specifications WHERE product_id = ? AND parameter = ?');
      for (const r of results) {
        const newSpec = findSpec.get(data.product_id, r.parameter);
        if (!newSpec) {
          db.prepare('DELETE FROM results WHERE id = ?').run(r.id);
        } else {
          const evaluation = evaluate(newSpec, r.value);
          db.prepare('UPDATE results SET specification_id = ?, status = ? WHERE id = ?').run(
            newSpec.id,
            evaluation.status,
            r.id
          );
          syncAlert(r.id, Number(req.params.id), evaluation);
        }
      }
    }
    res.json(db.prepare(SAMPLE_QUERY + ' WHERE s.id = ?').get(req.params.id));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe una muestra con ese código' });
    }
    throw e;
  }
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM samples WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Muestra no encontrada' });
  if (isDayLocked(sampleDay(existing.received_at))) return res.status(403).json(LOCKED_ERROR);
  db.prepare('DELETE FROM samples WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
