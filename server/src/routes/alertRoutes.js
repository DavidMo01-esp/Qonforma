import { Router } from 'express';
import db from '../db.js';

const router = Router();

const ALERT_QUERY = `
  SELECT a.*, s.code AS sample_code, s.batch AS sample_batch, s.container AS sample_container,
         p.name AS sample_product, p.code AS sample_product_code, u.username AS resolved_by_name
  FROM alerts a
  JOIN samples s ON s.id = a.sample_id
  JOIN products p ON p.id = s.product_id
  LEFT JOIN users u ON u.id = a.resolved_by
`;

router.get('/', (req, res) => {
  const { status } = req.query;
  let sql = ALERT_QUERY;
  const params = [];
  if (status === 'open' || status === 'resolved') {
    sql += ' WHERE a.status = ?';
    params.push(status);
  }
  sql += " ORDER BY CASE a.status WHEN 'open' THEN 0 ELSE 1 END, a.created_at DESC, a.id DESC";
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const alert = db.prepare(ALERT_QUERY + ' WHERE a.id = ?').get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alerta no encontrada' });
  res.json(alert);
});

router.patch('/:id/resolve', (req, res) => {
  const info = db
    .prepare("UPDATE alerts SET status = 'resolved', resolved_at = datetime('now'), resolved_by = ? WHERE id = ? AND status = 'open'")
    .run(req.user.id, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Alerta no encontrada o ya resuelta' });
  res.json(db.prepare(ALERT_QUERY + ' WHERE a.id = ?').get(req.params.id));
});

router.patch('/:id/reopen', (req, res) => {
  const info = db
    .prepare("UPDATE alerts SET status = 'open', resolved_at = NULL, resolved_by = NULL WHERE id = ? AND status = 'resolved'")
    .run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Alerta no encontrada o ya abierta' });
  res.json(db.prepare(ALERT_QUERY + ' WHERE a.id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM alerts WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Alerta no encontrada' });
  res.status(204).end();
});

export default router;
