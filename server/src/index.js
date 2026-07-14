import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './db.js';
import { seedDemoData } from './demoSeed.js';
import { requireAuth, requireAdmin } from './auth.js';
import lotRoutes from './routes/lotRoutes.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import specRoutes from './routes/specRoutes.js';
import sampleRoutes from './routes/sampleRoutes.js';
import resultRoutes from './routes/resultRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import dailyRoutes from './routes/dailyRoutes.js';

seedDemoData();

const app = express();
app.use(cors());
app.use(express.json());

// Lets the client know it is running against the public demo
app.get('/api/meta', (req, res) => {
  res.json({ demo: process.env.DEMO_MODE === '1' });
});

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

// In production the same server ships the built frontend (client/dist)
const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distDir, 'index.html')); // SPA fallback
  });
}

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API de control de calidad escuchando en http://localhost:${PORT}`));
