// Rapport automatique par test (voir README section "Rapports"). Pas de
// dépendance externe (pas d'import réseau jslib) pour rester fiable même
// sans accès Internet pendant l'exécution — uniquement les métriques déjà
// fournies par k6 dans `data` (argument de handleSummary).

function getMetric(data, name, stat, fallback) {
  if (!data.metrics || !data.metrics[name] || !data.metrics[name].values) return fallback;
  const v = data.metrics[name].values[stat];
  return v === undefined ? fallback : v;
}

function thresholdsPassed(data) {
  if (!data.metrics) return true;
  let allOk = true;
  const failed = [];
  for (const name of Object.keys(data.metrics)) {
    const th = data.metrics[name].thresholds;
    if (!th) continue;
    for (const expr of Object.keys(th)) {
      if (th[expr] && th[expr].ok === false) {
        allOk = false;
        failed.push(`${name}: ${expr}`);
      }
    }
  }
  return { allOk, failed };
}

export function buildReport(data, meta) {
  meta = meta || {};
  const th = thresholdsPassed(data);
  const durationMs = data.state && data.state.testRunDurationMs ? data.state.testRunDurationMs : null;

  return {
    test: meta.test || 'unnamed',
    date: new Date().toISOString(),
    version: meta.version || '1.0',
    environment: meta.environment || 'local',
    vus_max: getMetric(data, 'vus_max', 'max', null),
    duration_s: durationMs ? Math.round(durationMs / 1000) : null,
    requests_total: getMetric(data, 'http_reqs', 'count', 0),
    requests_per_s: round2(getMetric(data, 'http_reqs', 'rate', 0)),
    latency_ms: {
      avg: round2(getMetric(data, 'http_req_duration', 'avg', null)),
      p50: round2(getMetric(data, 'http_req_duration', 'med', null)),
      p90: round2(getMetric(data, 'http_req_duration', 'p(90)', null)),
      p95: round2(getMetric(data, 'http_req_duration', 'p(95)', null)),
      p99: round2(getMetric(data, 'http_req_duration', 'p(99)', null)),
      max: round2(getMetric(data, 'http_req_duration', 'max', null)),
    },
    error_rate: round4(getMetric(data, 'http_req_failed', 'rate', 0)),
    checks_rate: round4(getMetric(data, 'checks', 'rate', null)),
    thresholds_ok: th.allOk,
    thresholds_failed: th.failed,
    result: th.allOk ? 'PASS' : 'FAIL',
  };
}

function round2(v) {
  return v === null || v === undefined ? null : Math.round(v * 100) / 100;
}
function round4(v) {
  return v === null || v === undefined ? null : Math.round(v * 10000) / 10000;
}

export function textReport(r) {
  const lines = [
    '',
    '======================================================',
    `TEST        : ${r.test}`,
    `DATE        : ${r.date}`,
    `VERSION     : ${r.version}`,
    `ENVIRONMENT : ${r.environment}`,
    '------------------------------------------------------',
    `VUs (max)   : ${r.vus_max}`,
    `Durée       : ${r.duration_s}s`,
    `Requêtes    : ${r.requests_total} (${r.requests_per_s} req/s)`,
    '------------------------------------------------------',
    `p50         : ${r.latency_ms.p50} ms`,
    `p90         : ${r.latency_ms.p90} ms`,
    `p95         : ${r.latency_ms.p95} ms`,
    `p99         : ${r.latency_ms.p99} ms`,
    `max         : ${r.latency_ms.max} ms`,
    '------------------------------------------------------',
    `Taux d'erreur HTTP : ${(r.error_rate * 100).toFixed(2)}%`,
    `Taux de checks OK  : ${r.checks_rate === null ? 'n/a' : (r.checks_rate * 100).toFixed(2) + '%'}`,
    '------------------------------------------------------',
    `RÉSULTAT    : ${r.result}`,
  ];
  if (!r.thresholds_ok) {
    lines.push(`SEUILS ÉCHOUÉS : ${r.thresholds_failed.join(', ')}`);
  }
  lines.push('======================================================', '');
  return lines.join('\n');
}
