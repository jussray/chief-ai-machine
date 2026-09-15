import { createHash } from 'node:crypto';

export const METRIC_OBSERVATION_CONTRACT = 'juss-v10/metric-observation@v1';
export const METRICS_CSV_IMPORT_CONTRACT = 'juss-v10/metrics-csv-import@v1';
export const METRICS_CSV_COLUMNS = Object.freeze([
  'timestamp',
  'source',
  'workspace_id',
  'project_id',
  'account_id',
  'page_id',
  'audience_segment',
  'metric_name',
  'unit',
  'value',
  'idempotency_key',
  'provenance_ref',
]);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const METRIC_NAME = /^[a-z][a-z0-9_.-]{0,119}$/;
const UNITS = new Set(['count', 'ms', 'tokens', 'usd', 'ratio', 'score_0_1', 'boolean']);
const KNOWN_METRIC_UNITS = Object.freeze({
  provider_call: 'count',
  latency_ms: 'ms',
  input_tokens: 'tokens',
  output_tokens: 'tokens',
  quality_score: 'score_0_1',
  founder_override: 'boolean',
  goal_success: 'boolean',
  impressions: 'count',
  reactions: 'count',
  comments: 'count',
  profile_views: 'count',
  attributed_visits: 'count',
  qualified_conversations: 'count',
  attributed_contacts: 'count',
  attributed_deals: 'count',
});

function text(value, max = 512) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function nullableText(value, max = 512) {
  const normalized = text(value, max);
  return normalized || null;
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function fail(errors) {
  throw Object.assign(new Error(`METRIC_OBSERVATION_REJECTED: ${errors.join('; ')}`), {
    code: 'METRIC_OBSERVATION_REJECTED',
    details: errors,
  });
}

function validateTimestamp(value, field, errors) {
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(value))) errors.push(`${field} must be ISO UTC`);
}

function validateValue(value, unit, errors) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push('value must be a finite number; null and empty values must remain UNKNOWN outside the metric row');
    return;
  }
  if (['count', 'ms', 'tokens', 'usd'].includes(unit) && value < 0) {
    errors.push(`value must be non-negative for ${unit}`);
  }
  if (['ratio', 'score_0_1'].includes(unit) && (value < 0 || value > 1)) {
    errors.push(`value must be between 0 and 1 for ${unit}`);
  }
  if (unit === 'boolean' && value !== 0 && value !== 1) {
    errors.push('boolean metrics must use numeric 0 or 1');
  }
}

export function createMetricObservation(input = {}) {
  const errors = [];
  const timestamp = text(input.timestamp, 64);
  const source = text(input.source, 120).toLowerCase();
  const workspaceId = text(input.workspace_id, 160);
  const projectId = text(input.project_id, 160);
  const accountId = nullableText(input.account_id, 240);
  const pageId = nullableText(input.page_id, 240);
  const audienceSegment = nullableText(input.audience_segment, 240);
  const metricName = text(input.metric_name, 120).toLowerCase();
  const unit = text(input.unit, 40).toLowerCase();
  const idempotencyKey = text(input.idempotency_key, 320);
  const provenanceRef = text(input.provenance_ref, 600);

  validateTimestamp(timestamp, 'timestamp', errors);
  if (!source) errors.push('source is required');
  if (!workspaceId) errors.push('workspace_id is required');
  if (!projectId) errors.push('project_id is required');
  if (!METRIC_NAME.test(metricName)) errors.push('metric_name is invalid');
  if (!UNITS.has(unit)) errors.push('unit is invalid');
  const expectedUnit = KNOWN_METRIC_UNITS[metricName];
  if (expectedUnit && expectedUnit !== unit) {
    errors.push(`metric_name ${metricName} requires unit ${expectedUnit}`);
  }
  validateValue(input.value, unit, errors);
  if (!idempotencyKey) errors.push('idempotency_key is required');
  if (!provenanceRef) errors.push('provenance_ref is required');
  if (errors.length > 0) fail(errors);

  const identity = {
    contract: METRIC_OBSERVATION_CONTRACT,
    timestamp,
    source,
    workspace_id: workspaceId,
    project_id: projectId,
    account_id: accountId,
    page_id: pageId,
    audience_segment: audienceSegment,
    metric_name: metricName,
    unit,
    value: input.value,
    idempotency_key: idempotencyKey,
    provenance_ref: provenanceRef,
  };

  return Object.freeze({
    ...identity,
    observation_hash: hash(identity),
    authority: Object.freeze({
      measurement_only: true,
      may_change_canonical_state: false,
      may_increase_authority: false,
      missing_values_must_not_be_coerced_to_zero: true,
    }),
  });
}

function parseCsvRows(csv) {
  if (typeof csv !== 'string' || !csv.trim()) fail(['CSV input is required']);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) fail(['CSV contains an unterminated quoted field']);
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((value) => value !== ''));
}

function exactHeaderIndexes(header) {
  const normalized = header.map((value) => value.trim());
  const missing = METRICS_CSV_COLUMNS.filter((column) => !normalized.includes(column));
  const extras = normalized.filter((column) => !METRICS_CSV_COLUMNS.includes(column));
  if (missing.length || extras.length || normalized.length !== METRICS_CSV_COLUMNS.length) {
    fail([`CSV header mismatch; missing=${missing.join('|') || 'none'} extras=${extras.join('|') || 'none'}`]);
  }
  return Object.fromEntries(normalized.map((column, index) => [column, index]));
}

export function parseMetricsCsv(csv, options = {}) {
  const rows = parseCsvRows(csv);
  if (rows.length < 2) fail(['CSV must include a header and at least one data row']);
  const indexes = exactHeaderIndexes(rows[0]);
  const importBatchId = text(options.import_batch_id, 240);
  const importedAt = text(options.imported_at, 64);
  const errors = [];
  if (!importBatchId) errors.push('import_batch_id is required');
  validateTimestamp(importedAt, 'imported_at', errors);
  if (errors.length > 0) fail(errors);

  const seen = new Set();
  const observations = rows.slice(1).map((values, offset) => {
    if (values.length !== rows[0].length) {
      fail([`CSV row ${offset + 2} has ${values.length} columns; expected ${rows[0].length}`]);
    }
    const idempotencyKey = values[indexes.idempotency_key].trim();
    if (seen.has(idempotencyKey)) fail([`duplicate idempotency_key in import: ${idempotencyKey}`]);
    seen.add(idempotencyKey);

    const valueText = values[indexes.value].trim();
    if (!valueText) fail([`CSV row ${offset + 2} value is empty; represent missing data outside the metric row`]);
    const numericValue = Number(valueText);
    const sourceProvenance = values[indexes.provenance_ref].trim();
    return createMetricObservation({
      timestamp: values[indexes.timestamp],
      source: values[indexes.source],
      workspace_id: values[indexes.workspace_id],
      project_id: values[indexes.project_id],
      account_id: values[indexes.account_id],
      page_id: values[indexes.page_id],
      audience_segment: values[indexes.audience_segment],
      metric_name: values[indexes.metric_name],
      unit: values[indexes.unit],
      value: numericValue,
      idempotency_key: idempotencyKey,
      provenance_ref: `csv:${importBatchId}:row:${offset + 2}:${sourceProvenance}`,
    });
  });

  const identity = {
    contract: METRICS_CSV_IMPORT_CONTRACT,
    import_batch_id: importBatchId,
    imported_at: importedAt,
    row_count: observations.length,
    historical_timestamps_preserved: true,
    duplicate_policy: 'reject-within-batch',
    null_policy: 'reject-metric-row-null; optional identity fields normalize to null',
    observation_hashes: observations.map((item) => item.observation_hash),
  };

  return Object.freeze({
    ...identity,
    import_hash: hash(identity),
    observations: Object.freeze(observations),
  });
}
