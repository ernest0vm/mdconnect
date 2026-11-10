/**
 * A demo NetMD device for development: it replays an anonymised recording of a Sony MZ-NE410 with
 * a 60-track LP4 disc in three groups. Import it only from development code, so production builds
 * leave the recording out.
 */
import grouped from './fixtures/mz-ne410-grouped-lp4.json';
import { recordedDevice, type RecordedTransfer } from './recorded-device';
import type { NetMdUsbDevice } from './transport';

export { recordedDevice, type RecordedTransfer } from './recorded-device';

export const DEMO_VENDOR_ID = 0x054c;
export const DEMO_PRODUCT_ID = 0x00ca;

export function demoDevice(): NetMdUsbDevice {
  return recordedDevice(grouped.transfers as RecordedTransfer[]);
}
