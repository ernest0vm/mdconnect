import type { MdconnectBridge } from '../shared/bridge';

declare global {
  /** Injected by Vite `define`: the commit this build was made from, or ''. */
  const __MDCONNECT_COMMIT__: string;

  interface Window {
    readonly mdconnect: MdconnectBridge;
  }
}
