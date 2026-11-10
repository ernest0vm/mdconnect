/** The Emscripten module of atracdenc built by build.sh (MODULARIZE, EXPORT_ES6). */
export interface AtracdencModule {
  /** Runs atracdenc's `main` with these arguments; returns its exit code. */
  callMain(args: readonly string[]): number;
  readonly FS: {
    writeFile(path: string, data: Uint8Array): void;
    readFile(path: string): Uint8Array<ArrayBuffer>;
  };
}

export interface AtracdencOptions {
  print?: (text: string) => void;
  printErr?: (text: string) => void;
}

declare function createAtracdenc(options?: AtracdencOptions): Promise<AtracdencModule>;
export default createAtracdenc;
