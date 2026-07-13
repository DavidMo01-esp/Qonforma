import { Router } from 'express';
import db from '../db.js';
import { requireAdmin } from '../auth.js';

const router = Router();

// Reading is open to any authenticated user; changes are admin-only
router.use((req, res, next) => (req.method === 'GET' ? next() : requireAdmin(req, res, next)));

const SPEC_QUERY = `
  SELECT sp.*, p.name AS product_name
  FROM specifications sp JOIN products p ON p.id = sp.product_id
`;

function validate(body) {
  const { product_id, parameter, unit, min_value, max_value } = body || {};
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  if (!product) return { error: 'El producto indicado no existe' };
  if (!parameter || !parameter.trim()) return { error: 'El parámetro es obligatorio' };
  const min = min_value === '' || min_value == null ? null : Number(min_value);
  const max = max_value === '' || max_value == null ? null : Number(max_value);
  if (min !== null && Number.isNaN(min)) return { error: 'Mínimo debe ser numérico' };
  if (max !== null && Number.isNaN(max)) return { error: 'Máximo debe ser numérico' };
  if (min === null && max === null) return { error: 'Define al menos un límite (mínimo o máximo)' };
  if (min !== null && max !== null && min > max) return { error: 'El mínimo no puede ser mayor que el máximo' };
  return {
    data: {
      product_id: product.id,
      parameter: parameter.trim(),
      unit: (unit || '').trim(),
      min_value: min,
      max_value: max,
    },
  };
}

router.get('/', (req, res) => {
  const { product_id } = req.query;
  let sql = SPEC_QUERY;
  const params = [];
  if (product_id) {
    sql += ' WHERE sp.product_id = ?';
    params.push(product_id);
  }
  sql += ' ORDER BY p.name, sp.parameter';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const spec = db.prepare(SPEC_QUERY + ' WHERE sp.id = ?').get(req.params.id);
  if (!spec) return res.status(404).json({ error: 'Especificación no encontrada' });
  res.json(spec);
});

router.post('/', (req, res) => {
  const { error, data } = validate(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const info = db
      .prepare('INSERT INTO specifications (product_id, parameter, unit, min_value, max_value) VALUES (?, ?, ?, ?, ?)')
      .run(data.product_id, data.parameter, data.unit, data.min_value, data.max_value);
    res.status(201).json(db.prepare(SPEC_QUERY + ' WHERE sp.id = ?').get(info.lastInsertRowid));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ese producto ya tiene una especificación con ese parámetro' });
    }
    throw e;
  }
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM specifications WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Especificación no encontrada' });
  const { error, data } = validate(req.body);
  if (error) return res.status(400).json({ error });
  try {
    db.prepare(
      'UPDATE specifications SET product_id = ?, parameter = ?, unit = ?, min_value = ?, max_value = ? WHERE id = ?'
    ).run(data.product_id, data.parameter, data.unit, data.min_value, data.max_value, req.params.id);
    res.json(db.prepare(SPEC_QUERY + ' WHERE sp.id = ?').get(req.params.id));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ese producto ya tiene una especificación con ese parámetro' });
    }
    throw e;
  }
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM specifications WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Especificación no encontrada' });
  res.status(204).end();
});

export default router;
