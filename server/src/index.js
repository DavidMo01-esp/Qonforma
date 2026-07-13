import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import db from './db.js';
import { requireAuth, requireAdmin } from './auth.js';
import lotRoutes from './routes/lotRoutes.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import specRoutes from './routes/specRoutes.js';
import sampleRoutes from './routes/sampleRoutes.js';
import resultRoutes from './routes/resultRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import dailyRoutes from './routes/dailyRoutes.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/products', requireAuth, productRoutes);
app.use('/api/specifications', requireAuth, specRoutes);
app.use('/api/samples', requireAuth, sampleRoutes);
app.use('/api/results', requireAuth, resultRoutes);
app.use('/api/alerts', requireAuth, alertRoutes);
app.use('/api/daily', requireAuth, dailyRoutes);
app.use('/api/lots', requireAuth, lotRoutes);

// Consistent snapshot of the SQLite database, downloadable by an admin
app.get('/api/backup', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-');
    const file = path.join(os.tmpdir(), `qonforma-backup-${stamp}.db`);
    await db.backup(file);
    res.download(file, `qonforma-backup-${stamp}.db`, () => {
      fs.unlink(file, () => {});
    });
  } catch (e) {
    next(e);
  }
});

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API de control de calidad escuchando en http://localhost:${PORT}`));
