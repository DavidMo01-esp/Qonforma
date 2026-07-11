import express from 'express';
import cors from 'cors';
import db from './db.js';
import { requireAuth } from './auth.js';
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

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API de control de calidad escuchando en http://localhost:${PORT}`));
