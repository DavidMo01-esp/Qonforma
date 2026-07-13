import db from './db.js';

export function isDayLocked(day) {
  return Boolean(db.prepare('SELECT 1 FROM day_locks WHERE day = ?').get(day));
}

// Day (YYYY-MM-DD) a sample belongs to, from its received_at
export function sampleDay(receivedAt) {
  return (receivedAt || '').slice(0, 10);
}

// 403 response body shared by all guarded routes
export const LOCKED_ERROR = { error: 'Ese día está cerrado y no admite cambios' };
