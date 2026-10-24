declare module 'node:child_process' {
  interface ExecFileError extends Error {
    code?: string | number | null;
  }

  export function execFile(
    command: string,
    args: readonly string[],
    options: { timeout?: number; maxBuffer?: number },
    callback: (error: ExecFileError | null, stdout: string, stderr: string) => void,
  ): void;
}

declare module 'node:fs/promises' {
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  export function stat(path: string): Promise<{ size: number }>;
  export function mkdtemp(prefix: string): Promise<string>;
  export function readFile(path: string): Promise<Uint8Array>;
  export function rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  export function writeFile(path: string, data: string | Uint8Array, encoding?: 'utf8'): Promise<void>;
}

declare module 'node:os' {
  export function tmpdir(): string;
}

declare module 'node:path' {
  export function dirname(path: string): string;
  export function isAbsolute(path: string): boolean;
  export function join(...paths: string[]): string;
}
