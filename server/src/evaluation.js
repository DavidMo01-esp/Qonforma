import db from './db.js';

// Evaluates a value against a spec; returns { status, alertMessage | null }
export function evaluate(spec, value) {
  const belowMin = spec.min_value != null && value < spec.min_value;
  const aboveMax = spec.max_value != null && value > spec.max_value;
  if (!belowMin && !aboveMax) return { status: 'ok', alertMessage: null };
  const range =
    spec.min_value != null && spec.max_value != null
      ? `${spec.min_value} - ${spec.max_value}`
      : spec.min_value != null
        ? `mín. ${spec.min_value}`
        : `máx. ${spec.max_value}`;
  const unit = spec.unit ? ` ${spec.unit}` : '';
  return {
    status: 'out_of_spec',
    alertMessage: `${spec.parameter}: valor ${value}${unit} fuera de especificación (${range}${unit})`,
  };
}

// Creates or replaces the alert tied to a result according to its evaluation
export const syncAlert = db.transaction((resultId, sampleId, evaluation) => {
  db.prepare('DELETE FROM alerts WHERE result_id = ?').run(resultId);
  if (evaluation.status === 'out_of_spec') {
    db.prepare('INSERT INTO alerts (result_id, sample_id, message, severity) VALUES (?, ?, ?, ?)').run(
      resultId,
      sampleId,
      evaluation.alertMessage,
      'high'
    );
  }
});
