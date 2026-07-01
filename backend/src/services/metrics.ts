import { pool } from '../db/pool';

interface MetricStats {
  mean: number;
  stdDev: number;
  current: number;
  isAnomaly: boolean;
  sigmaDeviation: number;
}

export async function getMetricStats(
  teamId: string,
  metricKey: string,
  thresholdSigma = 2.0
): Promise<MetricStats | null> {
  const result = await pool.query(
    `SELECT value FROM metric_data_points
     WHERE team_id = $1 AND metric_key = $2
     ORDER BY recorded_at DESC LIMIT 100`,
    [teamId, metricKey]
  );

  if (result.rows.length < 3) return null;

  const values = result.rows.map((r: { value: string }) => parseFloat(r.value));
  const current = values[0];
  const historical = values.slice(1);

  const mean = historical.reduce((a, b) => a + b, 0) / historical.length;
  const variance = historical.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / historical.length;
  const stdDev = Math.sqrt(variance) || 1;
  const sigmaDeviation = Math.abs(current - mean) / stdDev;
  const isAnomaly = sigmaDeviation > thresholdSigma;

  return { mean, stdDev, current, isAnomaly, sigmaDeviation };
}

export async function checkAnomalies(teamId: string): Promise<Array<{
  metric_key: string;
  stats: MetricStats;
  alert_id: string;
}>> {
  const alerts = await pool.query(
    'SELECT id, metric_key, threshold_sigma FROM anomaly_alerts WHERE team_id = $1 AND is_active = true',
    [teamId]
  );

  const anomalies = [];
  for (const alert of alerts.rows) {
    const stats = await getMetricStats(teamId, alert.metric_key, parseFloat(alert.threshold_sigma));
    if (stats?.isAnomaly) {
      await pool.query(
        'UPDATE anomaly_alerts SET last_triggered_at = NOW() WHERE id = $1',
        [alert.id]
      );
      anomalies.push({ metric_key: alert.metric_key, stats, alert_id: alert.id });
    }
  }
  return anomalies;
}

export async function calculateKpi(
  teamId: string,
  numeratorMetric: string,
  denominatorMetric: string
): Promise<{ value: number; numerator: number; denominator: number } | null> {
  const numResult = await pool.query(
    `SELECT value FROM metric_data_points
     WHERE team_id = $1 AND metric_key = $2
     ORDER BY recorded_at DESC LIMIT 1`,
    [teamId, numeratorMetric]
  );
  const denResult = await pool.query(
    `SELECT value FROM metric_data_points
     WHERE team_id = $1 AND metric_key = $2
     ORDER BY recorded_at DESC LIMIT 1`,
    [teamId, denominatorMetric]
  );

  if (numResult.rows.length === 0 || denResult.rows.length === 0) return null;

  const numerator = parseFloat(numResult.rows[0].value);
  const denominator = parseFloat(denResult.rows[0].value);
  if (denominator === 0) return null;

  return { value: numerator / denominator, numerator, denominator };
}
