declare module 'cloudflare:workers' {
  export class WorkerEntrypoint<Env = Record<string, unknown>> {
    env: Env;
  }
}
