import type { NetMdUsbDevice } from '@mdconnect/netmd';

/** No-op NetMD transport methods, for test devices that never talk NetMD. */
export function netMdStub(): Omit<NetMdUsbDevice, 'opened' | 'open'> & {
  readonly opened: boolean;
} {
  return {
    opened: false,
    selectConfiguration: () => Promise.resolve(),
    claimInterface: () => Promise.resolve(),
    controlTransferIn: () => Promise.resolve({}),
    controlTransferOut: () => Promise.resolve({}),
    transferOut: () => Promise.resolve({}),
  };
}
