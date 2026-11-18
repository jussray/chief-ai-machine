declare module 'node:fs' {
  export function readFileSync(path: string | URL, encoding: 'utf8'): string;
  export function createReadStream(path: string): {
    on(event: string, handler: (...args: any[]) => void): any;
  };
  export function existsSync(path: string): boolean;
}
