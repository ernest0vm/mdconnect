import type { MdconnectBridge } from '../shared/bridge';

declare global {
  /** Injected by Vite `define`: the commit this build was made from, or ''. */
  const __MDCONNECT_COMMIT__: string;
  /** Injected by Vite `define`: the app version from package.json. */
  const __MDCONNECT_VERSION__: string;

  interface Window {
    readonly mdconnect: MdconnectBridge;
  }
}
