import { Router } from 'express';
import db from '../db.js';

const router = Router();

// Full traceability of one lot (lots are never reused): every sample with
// its results across days, plus the lot's alerts.
router.get('/:batch', (req, res) => {
  let batch = req.params.batch;
  const bySamples = db.prepare(
    `SELECT s.*, p.name AS product_name, p.code AS product_code
     FROM samples s JOIN products p ON p.id = s.product_id
     WHERE s.batch = ? ORDER BY s.received_at, s.id`
  );
  let samples = bySamples.all(batch);
  if (samples.length === 0) {
    // partial search: if exactly one lot matches, open it
    const matches = db
      .prepare("SELECT DISTINCT batch FROM samples WHERE batch LIKE ? AND batch != '' ORDER BY batch")
      .all(`%${batch}%`);
    if (matches.length === 1) {
      batch = matches[0].batch;
      samples = bySamples.all(batch);
    } else if (matches.length > 1) {
      return res.status(404).json({
        error: `Hay ${matches.length} lotes que contienen «${req.params.batch}»: ${matches.slice(0, 6).map((m) => m.batch).join(', ')}${matches.length > 6 ? '…' : ''}`,
      });
    }
  }
  if (samples.length === 0) return res.status(404).json({ error: 'No hay muestras con ese lote' });

  const getResults = db.prepare(
    `SELECT r.*, sp.parameter, sp.unit, sp.min_value, sp.max_value, u.username AS analyzed_by_name
     FROM results r
     JOIN specifications sp ON sp.id = r.specification_id
     LEFT JOIN users u ON u.id = r.analyzed_by
     WHERE r.sample_id = ? ORDER BY r.id`
  );
  const alerts = db
    .prepare(
      `SELECT a.*, u.username AS resolved_by_name
       FROM alerts a
       JOIN samples s ON s.id = a.sample_id
       LEFT JOIN users u ON u.id = a.resolved_by
       WHERE s.batch = ?
       ORDER BY a.created_at DESC, a.id DESC`
    )
    .all(batch);

  const specifications = db
    .prepare('SELECT * FROM specifications WHERE product_id = ? ORDER BY id')
    .all(samples[0].product_id);

  res.json({
    batch,
    product: {
      id: samples[0].product_id,
      name: samples[0].product_name,
      code: samples[0].product_code,
    },
    expiry_date: samples[0].expiry_date,
    line: samples[0].line,
    specifications,
    samples: samples.map((s) => ({ ...s, results: getResults.all(s.id) })),
    alerts,
  });
});

export default router;
