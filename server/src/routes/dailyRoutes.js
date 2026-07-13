import { Router } from 'express';
import db from '../db.js';
import { requireAdmin } from '../auth.js';
import { isDayLocked } from '../locks.js';

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Close a day: no more edits on its samples/results (any user can close)
router.post('/lock', (req, res) => {
  const { date } = req.body || {};
  if (!DATE_RE.test(date || '')) return res.status(400).json({ error: 'Fecha no válida' });
  db.prepare('INSERT OR IGNORE INTO day_locks (day, locked_by) VALUES (?, ?)').run(date, req.user.id);
  res.json({ day: date, locked: true });
});

// Reopen a day (admin only)
router.delete('/lock/:date', requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM day_locks WHERE day = ?').run(req.params.date);
  if (info.changes === 0) return res.status(404).json({ error: 'Ese día no estaba cerrado' });
  res.json({ day: req.params.date, locked: false });
});

// Days that have samples, newest first, with a day-level summary
router.get('/days', (req, res) => {
  const days = db
    .prepare(
      `SELECT date(s.received_at) AS day,
              COUNT(DISTINCT s.id) AS samples,
              COUNT(DISTINCT s.product_id || '|' || s.batch) AS lots,
              COUNT(DISTINCT CASE WHEN r.status = 'out_of_spec' THEN r.id END) AS out_of_spec
       FROM samples s
       LEFT JOIN results r ON r.sample_id = s.id
       GROUP BY day
       ORDER BY day DESC`
    )
    .all();
  res.json(days);
});

// Returns the whole day's sheet: every product with its specifications
// (so the grid can build columns and per-row cells) and all samples of the
// day across products, each with its results keyed by specification id.
router.get('/', (req, res) => {
  const { date } = req.query;
  if (!DATE_RE.test(date || '')) {
    return res.status(400).json({ error: 'Fecha no válida (formato YYYY-MM-DD)' });
  }
  const lock = db
    .prepare(
      `SELECT l.*, u.username AS locked_by_name FROM day_locks l
       LEFT JOIN users u ON u.id = l.locked_by WHERE l.day = ?`
    )
    .get(date);

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

  const getResults = db.prepare(
    `SELECT r.*, u.username AS analyzed_by_name FROM results r
     LEFT JOIN users u ON u.id = r.analyzed_by WHERE r.sample_id = ?`
  );
  res.json({
    products,
    locked: Boolean(lock),
    locked_by_name: lock?.locked_by_name || null,
    samples: samples.map((s) => ({
      ...s,
      results: Object.fromEntries(getResults.all(s.id).map((r) => [r.specification_id, r])),
    })),
  });
});

export default router;
