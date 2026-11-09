import type { MdconnectBridge } from '../shared/bridge';

declare global {
  interface Window {
    readonly mdconnect: MdconnectBridge;
  }
}
