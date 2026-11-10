/**
 * Synthetic replies that let the demo device take an upload: the secure session, the track
 * transfer, title writes and the commit. Nothing is stored, so the disc reads the same afterwards.
 * For development only, like the recordings it extends: it is not a protocol implementation.
 */

const SECURE = '1800080046f0030103';
const ACCEPTED = '09';
const INTERIM = '0f';
/** The playback status block of a stopped, ready device (operating status 0xc5ff). */
const READY_STATUS = `${ACCEPTED}1809800103308802003088050030880600100000090000000600000000c5ff00`;

/** Replies to the upload commands a recording does not hold. */
export class DemoUploads {
  private nextTrack: number;
  private expectedBytes = 0;
  private receivedBytes = 0;
  private sendingTrack = 0;
  /** Title writes are only accepted inside an upload session, so demo edits stay rejected. */
  private inSession = false;

  constructor(trackCount: number) {
    this.nextTrack = trackCount;
  }

  /** The reply (status byte included) to a command, or undefined to reject it. */
  reply(command: string): string | undefined {
    const body = command.slice(2);
    if (body.startsWith('ff010c') || body.startsWith('ff0100')) return ACCEPTED + body;
    if (body.startsWith('1809800103308802')) return READY_STATUS;
    // A title write for a new track: echo its first 20 bytes, as the device does.
    if (body.startsWith('1807')) return this.inSession ? ACCEPTED + body.slice(0, 40) : undefined;
    if (!body.startsWith(SECURE)) return undefined;
    const operation = body.slice(SECURE.length, SECURE.length + 2);
    const rest = body.slice(SECURE.length + 4);
    switch (operation) {
      case '2b':
        return `${ACCEPTED}${SECURE}2b00${rest}`;
      case '80':
      case '81':
        this.inSession = operation === '80';
        return `${ACCEPTED}${SECURE}${operation}00`;
      case '11':
        return `${ACCEPTED}${SECURE}1100${'01'.repeat(8)}`;
      case '12':
        return `${ACCEPTED}${SECURE}1201000000000000`;
      case '20':
        return `${ACCEPTED}${SECURE}2000000000${'a5'.repeat(8)}`;
      case '21':
        return `${ACCEPTED}${SECURE}2100000000`;
      case '22':
        return `${ACCEPTED}${SECURE}22000000`;
      case '28':
        // The last 4 bytes are the packet bytes to expect, header included.
        this.expectedBytes = Number.parseInt(body.slice(-8), 16);
        this.receivedBytes = 0;
        this.sendingTrack = this.nextTrack++;
        return `${INTERIM}${SECURE}2800${rest}`;
      case '48':
        return `${ACCEPTED}${SECURE}480000${rest.slice(2, 10)}`;
      default:
        return undefined;
    }
  }

  /** Counts track data; once all of it arrived, returns the reply that ends the transfer. */
  bulk(length: number): string | undefined {
    this.receivedBytes += length;
    if (this.expectedBytes === 0 || this.receivedBytes < this.expectedBytes) return undefined;
    this.expectedBytes = 0;
    const track = this.sendingTrack.toString(16).padStart(4, '0');
    // 28 00 000100 1001 <track> 00, six unused bytes, then the encrypted UUID and content ID.
    return `${ACCEPTED}${SECURE}28000001001001${track}00${'00'.repeat(10)}${'00'.repeat(32)}`;
  }
}
