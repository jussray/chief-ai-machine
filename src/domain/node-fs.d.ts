declare module 'node:fs' {
  interface ReadableFileStream {
    on(event: 'data', listener: (chunk: Uint8Array) => void): this;
    on(event: 'error', listener: (error: unknown) => void): this;
    on(event: 'end', listener: () => void): this;
  }

  export function createReadStream(path: string): ReadableFileStream;
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string | URL, encoding: 'utf8'): string;
}
