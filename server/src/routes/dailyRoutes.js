import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Returns the whole day's sheet: every product with its specifications
// (so the grid can build columns and per-row cells) and all samples of the
// day across products, each with its results keyed by specification id.
router.get('/', (req, res) => {
  const { date } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    return res.status(400).json({ error: 'Fecha no válida (formato YYYY-MM-DD)' });
  }

  const getSpecs = db.prepare('SELECT * FROM specifications WHERE product_id = ? ORDER BY id');
  const products = db
    .prepare('SELECT * FROM products ORDER BY name')
    .all()
    .map((p) => ({ ...p, specifications: getSpecs.all(p.id) }));

  const samples = db
    .prepare(
      `SELECT s.*, p.name AS product_name,
        (SELECT COUNT(*) FROM alerts a WHERE a.sample_id = s.id AND a.status = 'open') AS open_alerts
       FROM samples s
       JOIN products p ON p.id = s.product_id
       WHERE date(s.received_at) = ?
       ORDER BY s.received_at, s.id`
    )
    .all(date);

  const getResults = db.prepare('SELECT * FROM results WHERE sample_id = ?');
  res.json({
    products,
    samples: samples.map((s) => ({
      ...s,
      results: Object.fromEntries(getResults.all(s.id).map((r) => [r.specification_id, r])),
    })),
  });
});

export default router;
