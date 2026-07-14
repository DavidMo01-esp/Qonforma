import bcrypt from 'bcryptjs';
import db from './db.js';
import { evaluate } from './evaluation.js';

// Populates an empty database with realistic demo data so the deployed demo
// never looks empty. Only runs with DEMO_MODE=1 and an empty products table.

function dayStr(offset) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toLocaleDateString('sv'); // YYYY-MM-DD
}

function plusDays(date, days) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('sv');
}

function inRange(min, max) {
  const span = max - min;
  return Number((min + span * 0.15 + Math.random() * span * 0.7).toFixed(2));
}

export function seedDemoData() {
  if (process.env.DEMO_MODE !== '1') return;
  if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n > 0) return;

  // Secondary demo user to show the analyst role
  if (!db.prepare('SELECT 1 FROM users WHERE username = ?').get('analista')) {
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES ('analista', ?, 'analyst')").run(
      bcrypt.hashSync('analista1234', 10)
    );
  }
  const adminId = db.prepare("SELECT id FROM users ORDER BY id LIMIT 1").get()?.id ?? 1;

  const catalog = [
    {
      code: 'NP-0035',
      name: 'Nata 35%',
      description: 'Nata para montar 35% M.G.',
      specs: [
        ['pH', '', 6.4, 6.8],
        ['Grasa', '%', 34.5, 36.5],
        ['Extracto seco', '%', 41, 45],
      ],
    },
    {
      code: 'NP-0107',
      name: 'Yogur natural',
      description: 'Yogur natural de fermentación láctea',
      specs: [
        ['pH', '', 4.0, 4.6],
        ['Grasa', '%', 3.0, 4.5],
      ],
    },
    {
      code: 'NP-0012',
      name: 'Leche entera UHT',
      description: 'Leche entera esterilizada UHT',
      specs: [
        ['pH', '', 6.6, 6.8],
        ['Grasa', '%', 3.5, 3.8],
        ['Proteína', '%', 3.0, 3.6],
      ],
    },
  ];

  const insertProduct = db.prepare('INSERT INTO products (code, name, description) VALUES (?, ?, ?)');
  const insertSpec = db.prepare(
    'INSERT INTO specifications (product_id, parameter, unit, min_value, max_value) VALUES (?, ?, ?, ?, ?)'
  );
  const insertSample = db.prepare(
    `INSERT INTO samples (code, container, product_id, batch, expiry_date, line, status, created_by, received_at)
     VALUES (?, ?, ?, ?, ?, ?, 'in_analysis', ?, ?)`
  );
  const insertResult = db.prepare(
    `INSERT INTO results (sample_id, specification_id, value, status, analyzed_by, analyzed_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertAlert = db.prepare(
    `INSERT INTO alerts (result_id, sample_id, message, severity, status, created_at, resolved_at, resolved_by, resolution_note)
     VALUES (?, ?, ?, 'high', ?, ?, ?, ?, ?)`
  );

  const products = catalog.map((p) => {
    const id = insertProduct.run(p.code, p.name, p.description).lastInsertRowid;
    const specs = p.specs.map(([parameter, unit, min, max]) => ({
      id: insertSpec.run(id, parameter, unit, min, max).lastInsertRowid,
      parameter,
      unit,
      min_value: min,
      max_value: max,
    }));
    return { id, ...p, specs };
  });

  let lotCounter = 4053110;
  let sampleCounter = 0;

  // Three days of work: 2 days ago (closed), yesterday and today
  for (const offset of [2, 1, 0]) {
    const day = dayStr(offset);
    const compact = day.replaceAll('-', '');
    // per line: [product index, samples count]
    const plan = [
      { line: '1', productIdx: 0, samples: 4 },
      { line: '1', productIdx: 2, samples: 3 },
      { line: '2', productIdx: 1, samples: 3 },
    ];
    for (const { line, productIdx, samples } of plan) {
      const product = products[productIdx];
      const batch = String(lotCounter++);
      const expiry = plusDays(day, productIdx === 1 ? 28 : 90);
      for (let i = 0; i < samples; i++) {
        sampleCounter++;
        const hour = String(8 + i * 2).padStart(2, '0');
        const receivedAt = `${day} ${hour}:${['00', '10', '20', '30'][i % 4]}:00`;
        const sampleId = insertSample.run(
          `M-${compact}-${String(sampleCounter).padStart(3, '0')}`,
          String(i + 1),
          product.id,
          batch,
          expiry,
          line,
          adminId,
          receivedAt
        ).lastInsertRowid;

        for (const spec of product.specs) {
          let value = inRange(spec.min_value, spec.max_value);
          // A couple of deliberate out-of-spec values so alerts and red cells show up
          if (offset === 1 && productIdx === 0 && i === 2 && spec.parameter === 'Grasa') value = 37.4;
          if (offset === 0 && productIdx === 1 && i === 1 && spec.parameter === 'pH') value = 4.9;
          const evaluation = evaluate(spec, value);
          const resultId = insertResult.run(sampleId, spec.id, value, evaluation.status, adminId, receivedAt)
            .lastInsertRowid;
          if (evaluation.status === 'out_of_spec') {
            const resolved = offset > 0; // older alerts come resolved with a corrective action
            insertAlert.run(
              resultId,
              sampleId,
              evaluation.alertMessage,
              resolved ? 'resolved' : 'open',
              receivedAt,
              resolved ? `${day} 17:30:00` : null,
              resolved ? adminId : null,
              resolved ? 'Envase apartado y línea ajustada; verificado el envase siguiente.' : ''
            );
          }
        }
      }
    }
    if (offset === 2) {
      db.prepare('INSERT OR IGNORE INTO day_locks (day, locked_by) VALUES (?, ?)').run(day, adminId);
    }
  }

  console.log('Datos de demostración creados (3 productos, 3 días de registros)');
}
