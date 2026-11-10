/*
 * Ported from netmd-js 4.4.1, src/netmd-interface.ts (`Wireformat`, `DiscFormat`, `FrameSize`,
 * `discforwire`), https://github.com/cybercase/netmd-js, by Stefano Brilli and Asivery, GPL-2.0.
 *
 * Changes from upstream: one table per recording mode. SP mono is a mode of its own (PCM on the
 * wire, mono on the disc), as webminidisc sends it to decks that record mono natively.
 */

export type UploadMode = 'sp' | 'spMono' | 'lp2' | 'lp105' | 'lp4';

export interface UploadFormat {
  /** How the audio travels over USB. */
  readonly wireFormat: number;
  /** How the device stores it. */
  readonly discFormat: number;
  /** Bytes per frame on the wire; the audio is padded to whole frames. */
  readonly frameSize: number;
}

export const UPLOAD_FORMATS: Readonly<Record<UploadMode, UploadFormat>> = {
  sp: { wireFormat: 0x00, discFormat: 0x06, frameSize: 2048 },
  spMono: { wireFormat: 0x00, discFormat: 0x04, frameSize: 2048 },
  lp2: { wireFormat: 0x94, discFormat: 0x02, frameSize: 192 },
  lp105: { wireFormat: 0x90, discFormat: 0x02, frameSize: 152 },
  lp4: { wireFormat: 0xa8, discFormat: 0x00, frameSize: 96 },
};
