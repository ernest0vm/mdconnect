import { describe, expect, it } from 'vitest';

import recording from './fixtures/mz-n510-uploads.json';
import { NetMdInterface, type CommandChannel } from './interface';
import { bytes, key } from './testing/scripted-channel';
import { UploadSession } from './upload-session';

interface Step {
  readonly command: string;
  readonly replies: readonly string[];
  readonly bulkBytes: number;
}

/**
 * Replays a recorded upload in order: each command must match the recording byte for byte, and
 * gets the replies the deck sent to it. The audio is encrypted with a random key, so only its
 * total length is compared.
 */
function replay(steps: readonly Step[]) {
  let index = -1;
  let replied = 0;
  /** Replies read for each step, to check every recorded reply was consumed. */
  const consumed: number[] = [];
  let bulkBytes = 0;
  const mismatches: string[] = [];
  const channel: CommandChannel = {
    sendCommand: (command) => {
      index += 1;
      replied = 0;
      const expected = steps[index]?.command;
      if (key(command) !== expected) {
        mismatches.push(
          `command ${String(index)}: sent ${key(command)}, recorded ${String(expected)}`,
        );
      }
      return Promise.resolve();
    },
    readReply: () => {
      const reply = steps[index]?.replies[replied];
      replied += 1;
      consumed[index] = replied;
      return reply === undefined
        ? Promise.reject(new Error(`no recorded reply for command ${String(index)}`))
        : Promise.resolve(bytes(reply));
    },
    bulkWrite: (data) => {
      bulkBytes += data.length;
      return Promise.resolve();
    },
  };
  return {
    channel,
    mismatches,
    sentCommands: () => index + 1,
    /** Steps whose recorded replies were not all read, as `step: read/recorded`. */
    unreadReplies: () =>
      steps.flatMap((step, i) =>
        (consumed[i] ?? 0) === step.replies.length
          ? []
          : [`${String(i)}: ${String(consumed[i] ?? 0)}/${String(step.replies.length)}`],
      ),
    bulkBytes: () => bulkBytes,
  };
}

/** The host nonce the recording sent (session key exchange, `20 ff 000000 <nonce>`). */
function hostNonce(steps: readonly Step[]): Uint8Array {
  const exchange = steps.find((step) => step.command.startsWith('001800080046f003010320ff'));
  return bytes(exchange?.command.slice(-16) ?? '');
}

async function uploadAgainst(
  steps: readonly Step[],
  track: { readonly mode: 'sp' | 'lp2'; readonly length: number; readonly title: string },
) {
  const device = replay(steps);
  const nonce = hostNonce(steps);
  let draws = 0;
  const session = new UploadSession(
    new NetMdInterface(device.channel, { sleep: () => Promise.resolve() }),
    {
      vendorId: 0x054c,
      productId: 0x00c9,
      operatingState: () => Promise.resolve('ready'),
      // The first draw is the host nonce; later ones are data keys, which the recording cannot show.
      random: (length) => (draws++ === 0 ? nonce : new Uint8Array(length)),
      sleep: () => Promise.resolve(),
    },
  );
  await session.open();
  const number = await session.uploadTrack({
    mode: track.mode,
    data: new Uint8Array(track.length),
    title: track.title,
  });
  await session.close();
  return { device, number };
}

const recorded = recording.uploads as Readonly<Record<'sp' | 'lp2', readonly Step[]>>;
const recordedBulk = (steps: readonly Step[]) =>
  steps.reduce((sum, step) => sum + step.bulkBytes, 0);

describe('recorded uploads on a Sony MZ-N510/N610', () => {
  it('replays a 2-second SP upload command for command', async () => {
    // 2 s of 44.1 kHz 16-bit stereo PCM.
    const { device, number } = await uploadAgainst(recorded.sp, {
      mode: 'sp',
      length: 352_800,
      title: 'mdconnect SP test',
    });
    expect(device.mismatches).toEqual([]);
    expect(device.sentCommands()).toBe(recorded.sp.length);
    expect(device.unreadReplies()).toEqual([]);
    expect(device.bulkBytes()).toBe(recordedBulk(recorded.sp));
    expect(number).toBeGreaterThan(0);
  });

  it('replays a 3-second LP2 upload command for command', async () => {
    // 262 LP2 frames of 192 bytes, as the built-in encoder produced them.
    const { device } = await uploadAgainst(recorded.lp2, {
      mode: 'lp2',
      length: 262 * 192,
      title: 'mdconnect LP2 test',
    });
    expect(device.mismatches).toEqual([]);
    expect(device.sentCommands()).toBe(recorded.lp2.length);
    expect(device.unreadReplies()).toEqual([]);
    expect(device.bulkBytes()).toBe(recordedBulk(recorded.lp2));
  });
});
