import type { ChooserDevice } from '../../platform';
import { formatUsbId } from './connect-state';

export interface ChooserEntry {
  readonly deviceId: string;
  readonly title: string;
  readonly detail: string;
}

export interface ChooserView {
  readonly entries: readonly ChooserEntry[];
  /** True when two entries cannot be told apart, so the user should unplug one and retry. */
  readonly showUnplugHint: boolean;
}

/**
 * Labels the devices the desktop main process offers. Devices of the same model are told apart by
 * serial number; when serials are missing or equal they are numbered in list order instead.
 */
export function chooserView(devices: readonly ChooserDevice[]): ChooserView {
  const groups = new Map<string, ChooserDevice[]>();
  for (const device of devices) {
    const key = modelKey(device);
    groups.set(key, [...(groups.get(key) ?? []), device]);
  }
  const ambiguous = new Set(
    [...groups].filter(([, group]) => !hasDistinctSerials(group)).map(([key]) => key),
  );
  const seen = new Map<string, number>();

  const entries = devices.map((device) => {
    const key = modelKey(device);
    const id = formatUsbId(device.vendorId, device.productId);
    if (!ambiguous.has(key)) {
      const serial = device.serialNumber === undefined ? '' : ` · serial ${device.serialNumber}`;
      return { deviceId: device.deviceId, title: device.name, detail: `${id}${serial}` };
    }
    const position = (seen.get(key) ?? 0) + 1;
    seen.set(key, position);
    return { deviceId: device.deviceId, title: `${device.name} #${String(position)}`, detail: id };
  });

  return { entries, showUnplugHint: ambiguous.size > 0 };
}

function modelKey(device: ChooserDevice): string {
  return `${device.name}|${formatUsbId(device.vendorId, device.productId)}`;
}

function hasDistinctSerials(group: readonly ChooserDevice[]): boolean {
  if (group.length < 2) return true;
  const serials = group.map((d) => d.serialNumber);
  return serials.every((s) => s !== undefined) && new Set(serials).size === serials.length;
}
