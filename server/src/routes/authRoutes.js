import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { signToken, requireAuth } from '../auth.js';

const router = Router();

router.post('/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }
  try {
    const info = db
      .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
      .run(username.trim(), bcrypt.hashSync(password, 10));
    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ token: signToken(user), user });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ese nombre de usuario ya existe' });
    }
    throw e;
  }
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }
  const publicUser = { id: user.id, username: user.username, role: user.role };
  res.json({ token: signToken(publicUser), user: publicUser });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Indica la contraseña actual y la nueva' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'La contraseña nueva debe tener al menos 6 caracteres' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user || !bcrypt.compareSync(current_password, user.password_hash)) {
    return res.status(401).json({ error: 'La contraseña actual no es correcta' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(new_password, 10), user.id);
  res.json({ ok: true });
});

export default router;
