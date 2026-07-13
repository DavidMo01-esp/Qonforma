import { Router } from 'express';
import db from '../db.js';
import { evaluate, syncAlert } from '../evaluation.js';
import { isDayLocked, sampleDay, LOCKED_ERROR } from '../locks.js';

const router = Router();

const RESULT_QUERY = `
  SELECT r.*, s.code AS sample_code, p.name AS sample_product,
         sp.parameter, sp.unit, sp.min_value, sp.max_value,
         u.username AS analyzed_by_name
  FROM results r
  JOIN samples s ON s.id = r.sample_id
  JOIN products p ON p.id = s.product_id
  JOIN specifications sp ON sp.id = r.specification_id
  LEFT JOIN users u ON u.id = r.analyzed_by
`;

function validate(body) {
  const { sample_id, specification_id, value } = body || {};
  const sample = db.prepare('SELECT * FROM samples WHERE id = ?').get(sample_id);
  if (!sample) return { error: 'La muestra indicada no existe' };
  const spec = db.prepare('SELECT * FROM specifications WHERE id = ?').get(specification_id);
  if (!spec) return { error: 'La especificación indicada no existe' };
  if (spec.product_id !== sample.product_id) {
    return { error: 'La especificación no pertenece al producto de esta muestra' };
  }
  const num = Number(value);
  if (value === '' || value == null || Number.isNaN(num)) return { error: 'El valor debe ser numérico' };
  return { sample, spec, num };
}

router.get('/', (req, res) => {
  const { sample_id, status } = req.query;
  let sql = RESULT_QUERY;
  const where = [];
  const params = [];
  if (sample_id) {
    where.push('r.sample_id = ?');
    params.push(sample_id);
  }
  if (status === 'ok' || status === 'out_of_spec') {
    where.push('r.status = ?');
    params.push(status);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY r.analyzed_at DESC, r.id DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const result = db.prepare(RESULT_QUERY + ' WHERE r.id = ?').get(req.params.id);
  if (!result) return res.status(404).json({ error: 'Resultado no encontrado' });
  res.json(result);
});

router.post('/', (req, res) => {
  const { error, sample, spec, num } = validate(req.body);
  if (error) return res.status(400).json({ error });
  if (isDayLocked(sampleDay(sample.received_at))) return res.status(403).json(LOCKED_ERROR);
  const evaluation = evaluate(spec, num);
  const info = db
    .prepare('INSERT INTO results (sample_id, specification_id, value, status, notes, analyzed_by) VALUES (?, ?, ?, ?, ?, ?)')
    .run(sample.id, spec.id, num, evaluation.status, (req.body.notes || '').trim(), req.user.id);
  syncAlert(info.lastInsertRowid, sample.id, evaluation);
  if (sample.status === 'pending') {
    db.prepare("UPDATE samples SET status = 'in_analysis' WHERE id = ?").run(sample.id);
  }
  res.status(201).json(db.prepare(RESULT_QUERY + ' WHERE r.id = ?').get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM results WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Resultado no encontrado' });
  const { error, sample, spec, num } = validate(req.body);
  if (error) return res.status(400).json({ error });
  if (isDayLocked(sampleDay(sample.received_at))) return res.status(403).json(LOCKED_ERROR);
  const evaluation = evaluate(spec, num);
  db.prepare('UPDATE results SET sample_id = ?, specification_id = ?, value = ?, status = ?, notes = ? WHERE id = ?').run(
    sample.id,
    spec.id,
    num,
    evaluation.status,
    (req.body.notes || '').trim(),
    req.params.id
  );
  syncAlert(Number(req.params.id), sample.id, evaluation);
  res.json(db.prepare(RESULT_QUERY + ' WHERE r.id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db
    .prepare('SELECT r.id, s.received_at FROM results r JOIN samples s ON s.id = r.sample_id WHERE r.id = ?')
    .get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Resultado no encontrado' });
  if (isDayLocked(sampleDay(existing.received_at))) return res.status(403).json(LOCKED_ERROR);
  db.prepare('DELETE FROM results WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
