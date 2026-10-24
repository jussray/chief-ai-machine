export const RENDER_JOB_SCHEMA_VERSION = 1;
export const RENDER_JOB_PROJECT = 'chief-ai-machine';
export const RENDER_JOB_KIND = 'video.render';

export function assertRenderJob(job) {
  if (!job || job.schemaVersion !== RENDER_JOB_SCHEMA_VERSION) throw new Error('unsupported render job schema');
  if (job.project !== RENDER_JOB_PROJECT) throw new Error('render job project mismatch');
  if (job.kind !== RENDER_JOB_KIND) throw new Error('render job kind mismatch');
  if (job.authority?.render !== true) throw new Error('render authority required');
  if (job.authority?.publish !== false) throw new Error('publish authority must remain false');
  if (!job.id || !job.fingerprint || !job.input) throw new Error('render job missing required fields');
  return job;
}
