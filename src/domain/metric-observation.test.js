import { describe, expect, it } from 'vitest';
import {
  METRIC_OBSERVATION_CONTRACT,
  createMetricObservation,
  parseMetricsCsv,
} from './metric-observation.js';

const HEADER = 'timestamp,source,workspace_id,project_id,account_id,page_id,audience_segment,metric_name,unit,value,idempotency_key,provenance_ref';

describe('metric observations', () => {
  it('captures the business identity and provenance without inventing authority', () => {
    const observation = createMetricObservation({
      timestamp: '2026-09-01T12:00:00.000Z',
      source: 'anthropic-api',
      workspace_id: 'founder-control-room',
      project_id: 'chief-ai-machine',
      account_id: null,
      page_id: null,
      audience_segment: 'founder',
      metric_name: 'latency_ms',
      unit: 'ms',
      value: 842,
      idempotency_key: 'req-1:latency',
      provenance_ref: 'anthropic:req-1',
    });

    expect(observation.contract).toBe(METRIC_OBSERVATION_CONTRACT);
    expect(observation.account_id).toBeNull();
    expect(observation.page_id).toBeNull();
    expect(observation.audience_segment).toBe('founder');
    expect(observation.observation_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(observation.authority.may_increase_authority).toBe(false);
  });

  it('rejects null metric values instead of silently turning UNKNOWN into zero', () => {
    expect(() => createMetricObservation({
      timestamp: '2026-09-01T12:00:00.000Z',
      source: 'analytics',
      workspace_id: 'fcr',
      project_id: 'content',
      metric_name: 'impressions',
      unit: 'count',
      value: null,
      idempotency_key: 'missing-impressions',
      provenance_ref: 'analytics:missing',
    })).toThrow(/null and empty values must remain UNKNOWN/i);
  });

  it('rejects unit drift for known metrics', () => {
    expect(() => createMetricObservation({
      timestamp: '2026-09-01T12:00:00.000Z',
      source: 'anthropic-api',
      workspace_id: 'fcr',
      project_id: 'chief',
      metric_name: 'input_tokens',
      unit: 'count',
      value: 100,
      idempotency_key: 'req-2:input',
      provenance_ref: 'anthropic:req-2',
    })).toThrow(/requires unit tokens/);
  });

  it('imports safe historical CSV while preserving timestamps and nullable identities', () => {
    const csv = [
      HEADER,
      '2026-08-01T09:00:00.000Z,linkedin,founder-control-room,content-engine,,,build-in-public,impressions,count,1200,li-post-1:impressions,linkedin-export-2026-08',
      '2026-08-01T09:00:00.000Z,anthropic-api,founder-control-room,chief-ai-machine,,,founder,input_tokens,tokens,340,req-3:input,anthropic:req-3',
    ].join('\n');

    const result = parseMetricsCsv(csv, {
      import_batch_id: 'historical-2026-08',
      imported_at: '2026-09-15T22:00:00.000Z',
    });

    expect(result.row_count).toBe(2);
    expect(result.historical_timestamps_preserved).toBe(true);
    expect(result.observations[0].timestamp).toBe('2026-08-01T09:00:00.000Z');
    expect(result.observations[0].account_id).toBeNull();
    expect(result.observations[0].page_id).toBeNull();
    expect(result.observations[0].audience_segment).toBe('build-in-public');
  });

  it('rejects duplicate idempotency keys in the same import', () => {
    const csv = [
      HEADER,
      '2026-08-01T09:00:00.000Z,linkedin,fcr,content,,,founder,impressions,count,10,same-key,export-a',
      '2026-08-02T09:00:00.000Z,linkedin,fcr,content,,,founder,impressions,count,11,same-key,export-b',
    ].join('\n');

    expect(() => parseMetricsCsv(csv, {
      import_batch_id: 'duplicate-test',
      imported_at: '2026-09-15T22:00:00.000Z',
    })).toThrow(/duplicate idempotency_key/);
  });

  it('rejects empty CSV metric values rather than fabricating historical data', () => {
    const csv = [
      HEADER,
      '2026-08-01T09:00:00.000Z,linkedin,fcr,content,,,founder,impressions,count,,missing-value,export-a',
    ].join('\n');

    expect(() => parseMetricsCsv(csv, {
      import_batch_id: 'null-test',
      imported_at: '2026-09-15T22:00:00.000Z',
    })).toThrow(/value is empty/);
  });
});
