/*
 * Supported MiniDisc USB devices.
 *
 * NetMD entries are copied from netmd-js 4.4.1 (`DevicesIds`, https://github.com/cybercase/netmd-js)
 * and Hi-MD entries from himd-js 0.2.15 (`DevicesIds`, https://github.com/asivery/himd-js).
 * Both projects are licensed under GPL-2.0; this file is distributed under the same license.
 * Names and IDs are kept exactly as upstream lists them.
 */

export type DeviceKind = 'netmd' | 'himd';

export interface SupportedDevice {
  readonly vendorId: number;
  readonly productId: number;
  readonly name: string;
  readonly kind: DeviceKind;
  /** The deck records SP mono from a stereo upload by itself (netmd-js `nativeMonoUpload`). */
  readonly nativeMonoUpload?: true;
}

export const SUPPORTED_DEVICES: readonly SupportedDevice[] = [
  // netmd-js 4.4.1
  { vendorId: 0x04dd, productId: 0x7202, name: 'Sharp IM-MT899H', kind: 'netmd' },
  { vendorId: 0x04dd, productId: 0x9013, name: 'Sharp IM-DR400', kind: 'netmd' },
  {
    vendorId: 0x04dd,
    productId: 0x9014,
    name: 'Sharp IM-DR80',
    kind: 'netmd',
    nativeMonoUpload: true,
  },
  { vendorId: 0x054c, productId: 0x0034, name: 'Sony PCLK-XX', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x0036, name: 'Sony', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x0075, name: 'Sony MZ-N1', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x007c, name: 'Sony', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x0080, name: 'Sony LAM-1', kind: 'netmd' },
  {
    vendorId: 0x054c,
    productId: 0x0081,
    name: 'Sony MDS-JB980/MDS-NT1/MDS-JE780',
    kind: 'netmd',
    nativeMonoUpload: true,
  },
  { vendorId: 0x054c, productId: 0x0084, name: 'Sony MZ-N505', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x0085, name: 'Sony MZ-S1', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x0086, name: 'Sony MZ-N707', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x008e, name: 'Sony CMT-C7NT', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x0097, name: 'Sony PCGA-MDN1', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x00ad, name: 'Sony CMT-L7HD', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x00c6, name: 'Sony MZ-N10', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x00c7, name: 'Sony MZ-N910', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x00c8, name: 'Sony MZ-N710/NF810', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x00c9, name: 'Sony MZ-N510/N610', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x00ca, name: 'Sony MZ-NE410/NF520D', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x00e7, name: 'Sony CMT-M333NT/M373NT', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x00eb, name: 'Sony MZ-NE810/NE910', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x0101, name: 'Sony LAM', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x0113, name: 'Aiwa AM-NX1', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x013f, name: 'Sony MDS-S500', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x014c, name: 'Aiwa AM-NX9', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x017e, name: 'Sony MZ-NH1', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x0180, name: 'Sony MZ-NH3D', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x0182, name: 'Sony MZ-NH900', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x0184, name: 'Sony MZ-NH700/NH800', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x0186, name: 'Sony MZ-NH600', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x0187, name: 'Sony MZ-NH600D', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x0188, name: 'Sony MZ-N920', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x018a, name: 'Sony LAM-3', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x01e9, name: 'Sony MZ-DH10P', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x0219, name: 'Sony MZ-RH10', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x021b, name: 'Sony MZ-RH710/MZ-RH910', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x021d, name: 'Sony CMT-AH10', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x022c, name: 'Sony CMT-AH10', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x023c, name: 'Sony DS-HMD1', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x0286, name: 'Sony MZ-RH1', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x011a, name: 'Sony CMT-SE7', kind: 'netmd' },
  { vendorId: 0x054c, productId: 0x0148, name: 'Sony MDS-A1', kind: 'netmd' },
  { vendorId: 0x0b28, productId: 0x1004, name: 'Kenwood MDX-J9', kind: 'netmd' },
  {
    vendorId: 0x04da,
    productId: 0x23b3,
    name: 'Panasonic SJ-MR250',
    kind: 'netmd',
    nativeMonoUpload: true,
  },
  {
    vendorId: 0x04da,
    productId: 0x23b6,
    name: 'Panasonic SJ-MR270',
    kind: 'netmd',
    nativeMonoUpload: true,
  },
  { vendorId: 0x0411, productId: 0x0083, name: 'Buffalo MD-HUSB', kind: 'netmd' },
  // himd-js 0.2.15 (Hi-MD mode: USB mass storage)
  { vendorId: 0x5341, productId: 0x5256, name: 'Exploit-Unrestricted', kind: 'himd' },
  { vendorId: 0x054c, productId: 0x017f, name: 'Sony MZ-NH1', kind: 'himd' },
  { vendorId: 0x054c, productId: 0x0181, name: 'Sony MZ-NH3D', kind: 'himd' },
  { vendorId: 0x054c, productId: 0x0183, name: 'Sony MZ-NH900', kind: 'himd' },
  { vendorId: 0x054c, productId: 0x0185, name: 'Sony MZ-NH700', kind: 'himd' },
  { vendorId: 0x054c, productId: 0x0187, name: 'Sony MZ-NH600', kind: 'himd' },
  { vendorId: 0x054c, productId: 0x018b, name: 'Sony LAM', kind: 'himd' },
  { vendorId: 0x054c, productId: 0x01ea, name: 'Sony MZ-DH10P', kind: 'himd' },
  { vendorId: 0x054c, productId: 0x021a, name: 'Sony MZ-RH10', kind: 'himd' },
  { vendorId: 0x054c, productId: 0x021c, name: 'Sony MZ-RH910', kind: 'himd' },
  { vendorId: 0x054c, productId: 0x022d, name: 'Sony CMT-AH10', kind: 'himd' },
  { vendorId: 0x054c, productId: 0x023d, name: 'Sony DS-HMD1', kind: 'himd' },
  { vendorId: 0x054c, productId: 0x0287, name: 'Sony MZ-RH1', kind: 'himd' },
  { vendorId: 0x0411, productId: 0x007f, name: 'Buffalo MD-HUSB', kind: 'himd' },
];

/**
 * Finds the table entry for a USB ID pair. One pair (054c:0187) appears in both upstream tables;
 * NetMD entries come first, so lookups return the NetMD name for it.
 */
export function findDevice(vendorId: number, productId: number): SupportedDevice | undefined {
  return SUPPORTED_DEVICES.find((d) => d.vendorId === vendorId && d.productId === productId);
}

/** Whether the USB ID pair is in the supported device table (either kind). */
export function isSupportedDevice(vendorId: number, productId: number): boolean {
  return findDevice(vendorId, productId) !== undefined;
}

/** A WebUSB request filter; structurally compatible with the DOM's `USBDeviceFilter`. */
export interface UsbFilter {
  readonly vendorId: number;
  readonly productId: number;
}

export interface UsbFilterOptions {
  /** Device kinds to include; defaults to every kind. The web app requests NetMD only. */
  readonly kinds?: readonly DeviceKind[];
}

/** WebUSB request filters: one per unique vendor/product pair among the selected kinds. */
export function usbFilters(options: UsbFilterOptions = {}): UsbFilter[] {
  const kinds = new Set<DeviceKind>(options.kinds ?? ['netmd', 'himd']);
  const seen = new Set<string>();
  const filters: UsbFilter[] = [];
  for (const { vendorId, productId, kind } of SUPPORTED_DEVICES) {
    if (!kinds.has(kind)) continue;
    const key = `${String(vendorId)}:${String(productId)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    filters.push({ vendorId, productId });
  }
  return filters;
}
