import { describe, expect, it } from 'vitest';

import { Des } from './des';
import { NetMdRejectedError } from './errors';
import { NetMdInterface, type CommandChannel } from './interface';
import { bytes, channel, key, noSleep } from './testing/scripted-channel';

const k = (hex: string) => key(bytes(hex));
const SECURE = '1800 080046 f0030103';
const SESSION_KEY = bytes('0102030405060708');

describe('sendQuery', () => {
  it('returns an interim reply when the caller accepts one', async () => {
    const { ch } = channel({ '00 1806': '0f 1806 01' });
    const reply = await new NetMdInterface(ch, { sleep: noSleep }).sendQuery(bytes('1806'), {
      acceptInterim: true,
    });
    expect(key(reply)).toBe('180601');
  });

  it('still retries an interim reply by default', async () => {
    const { ch } = channel({ '00 1806': '0f 1806' });
    await expect(
      new NetMdInterface(ch, { sleep: noSleep }).sendQuery(bytes('1806')),
    ).rejects.toThrow(/interim/i);
  });
});

describe('session commands', () => {
  const accepted = (command: string, reply: string) => ({ [`00 ${command}`]: `09 ${reply}` });

  it('acquires and releases the device', async () => {
    const acquire = 'ff 010c ffff ffff ffff ffff ffff ffff';
    const release = 'ff 0100 ffff ffff ffff ffff ffff ffff';
    const { ch, sent } = channel({
      ...accepted(acquire, acquire),
      ...accepted(release, release),
    });
    const md = new NetMdInterface(ch, { sleep: noSleep });
    await md.acquire();
    await md.release();
    expect(sent).toEqual([k(`00 ${acquire}`), k(`00 ${release}`)]);
  });

  it('disables new-track protection', async () => {
    const { ch, sent } = channel(accepted(`${SECURE} 2b ff 0001`, `${SECURE} 2b 00 0001`));
    await new NetMdInterface(ch, { sleep: noSleep }).disableNewTrackProtection(1);
    expect(sent).toEqual([k(`00 ${SECURE} 2b ff 0001`)]);
  });

  it('enters and leaves the secure session', async () => {
    const { ch, sent } = channel({
      ...accepted(`${SECURE} 80 ff`, `${SECURE} 80 00`),
      ...accepted(`${SECURE} 81 ff`, `${SECURE} 81 00`),
    });
    const md = new NetMdInterface(ch, { sleep: noSleep });
    await md.enterSecureSession();
    await md.leaveSecureSession();
    expect(sent).toEqual([k(`00 ${SECURE} 80 ff`), k(`00 ${SECURE} 81 ff`)]);
  });

  it('reads the leaf ID', async () => {
    const { ch } = channel(accepted(`${SECURE} 11 ff`, `${SECURE} 11 00 0001020304050607`));
    expect(key(await new NetMdInterface(ch, { sleep: noSleep }).getLeafId())).toBe(
      '0001020304050607',
    );
  });

  it('sends the EKB key data with its lengths, depth and ID', async () => {
    const chain = [bytes('11'.repeat(16)), bytes('22'.repeat(16))];
    const signature = bytes('33'.repeat(24));
    // 16 + 16 * 2 + 24 = 72 = 0x48 bytes.
    const command = `${SECURE} 12 ff 0048 0000 0048 00000002 00000009 26422642 00000000 ${'11'.repeat(16)}${'22'.repeat(16)}${'33'.repeat(24)}`;
    const { ch, sent } = channel(accepted(command, `${SECURE} 12 01 0000 00000000`));
    await new NetMdInterface(ch, { sleep: noSleep }).sendKeyData(0x26422642, chain, 9, signature);
    expect(sent).toEqual([k(`00 ${command}`)]);
  });

  it('exchanges nonces, accepting any status byte in the reply (Panasonic SJ-MR270)', async () => {
    const { ch } = channel(
      accepted(
        `${SECURE} 20 ff 000000 0102030405060708`,
        `${SECURE} 20 01 000000 a1a2a3a4a5a6a7a8`,
      ),
    );
    const nonce = await new NetMdInterface(ch, { sleep: noSleep }).sessionKeyExchange(
      bytes('0102030405060708'),
    );
    expect(key(nonce)).toBe('a1a2a3a4a5a6a7a8');
  });

  it('forgets the session key', async () => {
    const { ch, sent } = channel(accepted(`${SECURE} 21 ff 000000`, `${SECURE} 21 00 000000`));
    await new NetMdInterface(ch, { sleep: noSleep }).sessionKeyForget();
    expect(sent).toEqual([k(`00 ${SECURE} 21 ff 000000`)]);
  });

  it('sets up a download with the content ID and KEK encrypted under the session key', async () => {
    const contentId = bytes('aa'.repeat(20));
    const kek = bytes('bb'.repeat(8));
    const message = bytes(`01010101 ${'aa'.repeat(20)} ${'bb'.repeat(8)}`);
    const encrypted = key(new Des(SESSION_KEY).encryptCbc(message, new Uint8Array(8)));
    const { ch, sent } = channel(
      accepted(`${SECURE} 22 ff 0000 ${encrypted}`, `${SECURE} 22 00 0000`),
    );
    await new NetMdInterface(ch, { sleep: noSleep }).setupDownload(contentId, kek, SESSION_KEY);
    expect(sent).toEqual([k(`00 ${SECURE} 22 ff 0000 ${encrypted}`)]);
  });

  it('commits a track with the session key authentication', async () => {
    const auth = key(new Des(SESSION_KEY).encryptEcb(new Uint8Array(8)));
    const command = `${SECURE} 48 ff 00 1001 0005 ${auth}`;
    const { ch, sent } = channel(accepted(command, `${SECURE} 48 00 00 1001 0005`));
    await new NetMdInterface(ch, { sleep: noSleep }).commitTrack(5, SESSION_KEY);
    expect(sent).toEqual([k(`00 ${command}`)]);
  });

  it('fails a command the device rejects', async () => {
    const { ch } = channel({ [`00 ${SECURE} 80 ff`]: `0a ${SECURE} 80 ff` });
    await expect(
      new NetMdInterface(ch, { sleep: noSleep }).enterSecureSession(),
    ).rejects.toBeInstanceOf(NetMdRejectedError);
  });
});

describe('sendTrack', () => {
  const command = `${SECURE} 28 ff 000100 1001 ffff 00 94 02 00000003 00000258`;
  const uuid = '0102030405060708';
  const contentId = '11'.repeat(20);
  // Bytes 8 to 11 of the decrypted reply are not used.
  const replyPlain = bytes(`${uuid} 00000000 ${contentId}`);
  const replyEncrypted = key(new Des(SESSION_KEY).encryptCbc(replyPlain, new Uint8Array(8)));

  /** A channel that answers the track command, takes the packets, then sends the final reply. */
  function trackChannel(first: string) {
    const log: string[] = [];
    const readOptions: unknown[] = [];
    let replies = 0;
    const ch: CommandChannel = {
      sendCommand: (data) => {
        log.push(`command ${key(data)}`);
        return Promise.resolve();
      },
      readReply: (options) => {
        readOptions.push(options);
        replies += 1;
        return Promise.resolve(
          bytes(
            replies === 1
              ? first
              : `09 ${SECURE} 28 00 000100 1001 0007 00 0000 00000000 00000000 ${replyEncrypted}`,
          ),
        );
      },
      bulkWrite: (data) => {
        log.push(`bulk ${String(data.length)}`);
        return Promise.resolve();
      },
    };
    return { ch, log, readOptions };
  }

  async function* packets() {
    await Promise.resolve();
    yield new Uint8Array(24 + 288);
    yield new Uint8Array(288);
  }

  const params = { wireFormat: 0x94, discFormat: 0x02, frames: 3, dataLength: 576 };

  it('sends the track command, the packets, and decrypts the new track identity (LP2)', async () => {
    const { ch, log } = trackChannel(`0f ${SECURE} 28 00 000100 1001 ffff 00 94 02`);
    const sleeps: number[] = [];
    const md = new NetMdInterface(ch, {
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
    });
    const result = await md.sendTrack(params, packets(), SESSION_KEY);
    expect(log).toEqual([`command 00${k(command)}`, 'bulk 312', 'bulk 288']);
    expect(result.track).toBe(7);
    expect(key(result.uuid)).toBe(uuid);
    expect(key(result.contentId)).toBe(contentId);
    // Sharp decks need a pause before the command and before the data.
    expect(sleeps).toEqual([200, 200]);
  });

  it('waits up to five minutes for the final reply, past the usual limit', async () => {
    const { ch, readOptions } = trackChannel(`09 ${SECURE} 28 00 000100 1001 ffff 00 94 02`);
    await new NetMdInterface(ch, { sleep: noSleep }).sendTrack(params, packets(), SESSION_KEY);
    expect(readOptions[1]).toEqual({ timeoutMs: 5 * 60_000 });
  });

  it('reports the bytes written after each packet', async () => {
    const { ch } = trackChannel(`0f ${SECURE} 28 00 000100 1001 ffff 00 94 02`);
    const progress: number[] = [];
    await new NetMdInterface(ch, { sleep: noSleep }).sendTrack(
      params,
      packets(),
      SESSION_KEY,
      (p) => {
        progress.push(p.writtenBytes);
      },
    );
    expect(progress).toEqual([312, 600]);
  });

  it('needs a channel that can write bulk data', async () => {
    const { ch } = channel({});
    await expect(
      new NetMdInterface(ch, { sleep: noSleep }).sendTrack(params, packets(), SESSION_KEY),
    ).rejects.toThrow(/bulk/);
  });
});
