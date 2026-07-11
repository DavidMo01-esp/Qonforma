import { Router } from 'express';
import db from '../db.js';

const router = Router();

const PRODUCT_QUERY = `
  SELECT p.*,
    (SELECT COUNT(*) FROM specifications sp WHERE sp.product_id = p.id) AS spec_count,
    (SELECT COUNT(*) FROM samples s WHERE s.product_id = p.id) AS sample_count
  FROM products p
`;

function validate(body) {
  const { code, name, description } = body || {};
  if (!name || !name.trim()) return { error: 'El nombre del producto es obligatorio' };
  return {
    data: {
      code: (code || '').trim(),
      name: name.trim(),
      description: (description || '').trim(),
    },
  };
}

function conflictMessage(e) {
  const msg = String(e.message);
  if (msg.includes('idx_products_code') || msg.includes('products.code')) {
    return 'Ya existe un producto con ese código';
  }
  if (msg.includes('UNIQUE')) return 'Ya existe un producto con ese nombre';
  return null;
}

router.get('/', (req, res) => {
  res.json(db.prepare(PRODUCT_QUERY + ' ORDER BY p.name').all());
});

router.get('/:id', (req, res) => {
  const product = db.prepare(PRODUCT_QUERY + ' WHERE p.id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  const specifications = db
    .prepare('SELECT * FROM specifications WHERE product_id = ? ORDER BY parameter')
    .all(req.params.id);
  res.json({ ...product, specifications });
});

router.post('/', (req, res) => {
  const { error, data } = validate(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const info = db
      .prepare('INSERT INTO products (code, name, description) VALUES (?, ?, ?)')
      .run(data.code, data.name, data.description);
    res.status(201).json(db.prepare(PRODUCT_QUERY + ' WHERE p.id = ?').get(info.lastInsertRowid));
  } catch (e) {
    const msg = conflictMessage(e);
    if (msg) return res.status(409).json({ error: msg });
    throw e;
  }
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });
  const { error, data } = validate(req.body);
  if (error) return res.status(400).json({ error });
  try {
    db.prepare('UPDATE products SET code = ?, name = ?, description = ? WHERE id = ?').run(
      data.code,
      data.name,
      data.description,
      req.params.id
    );
    res.json(db.prepare(PRODUCT_QUERY + ' WHERE p.id = ?').get(req.params.id));
  } catch (e) {
    const msg = conflictMessage(e);
    if (msg) return res.status(409).json({ error: msg });
    throw e;
  }
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' });
  res.status(204).end();
});

export default router;
