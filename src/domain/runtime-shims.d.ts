declare module 'node:child_process' {
  export function execFile(
    file: string,
    args: string[],
    options: Record<string, unknown>,
    callback: (error: any, stdout: string | Uint8Array, stderr: string | Uint8Array) => void,
  ): void;
}

declare module 'node:fs/promises' {
  export function mkdir(path: string, options?: Record<string, unknown>): Promise<any>;
  export function stat(path: string): Promise<{ size: number }>;
  export function mkdtemp(prefix: string): Promise<string>;
  export function readFile(path: string, encoding?: string): Promise<any>;
  export function rm(path: string, options?: Record<string, unknown>): Promise<void>;
  export function writeFile(path: string, data: any, encoding?: string): Promise<void>;
}

declare module 'node:path' {
  export function dirname(path: string): string;
  export function isAbsolute(path: string): boolean;
  export function join(...parts: string[]): string;
}

declare module 'node:os' {
  export function tmpdir(): string;
}

declare module 'cloudflare:workers' {
  export class WorkerEntrypoint<Env = Record<string, unknown>> {
    env: Env;
    constructor(ctx?: unknown, env?: Env);
  }
}
