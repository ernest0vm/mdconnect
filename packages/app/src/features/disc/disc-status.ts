import type { Disc } from '@mdconnect/netmd';

import type { DiscReadResult } from './disc-reader';
import type { DiscView } from './disc-view';

export type DiscStatus =
  | { readonly kind: 'reading'; readonly title: string }
  | { readonly kind: 'disc'; readonly disc: DiscView; readonly raw: Disc }
  | {
      readonly kind: 'notice' | 'warning';
      readonly title: string;
      readonly message: string;
      readonly action: 'Refresh' | 'Retry';
    };

/** What the disc panel shows for a read in progress or a read result; never a raw error. */
export function discStatus(result: DiscReadResult | 'reading'): DiscStatus {
  if (result === 'reading') return { kind: 'reading', title: 'Reading disc…' };
  switch (result.kind) {
    case 'disc':
      return { kind: 'disc', disc: result.disc, raw: result.raw };
    case 'no-disc':
      return {
        kind: 'notice',
        title: 'No disc inserted',
        message: 'Insert a MiniDisc, then refresh.',
        action: 'Refresh',
      };
    case 'failed':
      if (result.reason === 'unavailable') {
        return {
          kind: 'warning',
          title: 'Device in use',
          message:
            'mdconnect could not open the device. If another app or browser tab is using it, close that first, then retry.',
          action: 'Retry',
        };
      }
      return result.reason === 'not-netmd'
        ? {
            kind: 'warning',
            title: 'Cannot read this device',
            message:
              'The device is in Hi-MD mode. mdconnect cannot read discs in Hi-MD mode yet; switch the device to NetMD mode if it offers one, then retry.',
            action: 'Retry',
          }
        : {
            kind: 'warning',
            title: 'Could not read the disc',
            message:
              'The device stopped answering while the disc was read. Check the disc and the cable, then retry.',
            action: 'Retry',
          };
  }
}
