import type { CommandChannel } from '../interface';

export const bytes = (hex: string) =>
  new Uint8Array(
    (hex.replace(/\s+/g, '').match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16)),
  );
export const key = (data: Uint8Array) =>
  [...data].map((b) => b.toString(16).padStart(2, '0')).join('');
export const ascii = (text: string) => key(new TextEncoder().encode(text));
export const word = (n: number) => n.toString(16).padStart(4, '0');

/**
 * A NetMD channel that answers each exact command with a scripted reply (status byte included).
 * Descriptor open/close commands (1808…) are accepted unless scripted otherwise.
 */
export function channel(script: Record<string, string>) {
  const replies = new Map(Object.entries(script).map(([cmd, reply]) => [key(bytes(cmd)), reply]));
  const sent: string[] = [];
  let last = '';
  const ch: CommandChannel = {
    sendCommand: (command) => {
      last = key(command);
      sent.push(last);
      return Promise.resolve();
    },
    readReply: () => {
      const scripted = replies.get(last);
      if (scripted !== undefined) return Promise.resolve(bytes(scripted));
      if (last.startsWith('001808')) return Promise.resolve(bytes(`09${last.slice(2)}`));
      return Promise.reject(new Error(`unscripted command ${last}`));
    },
  };
  return { ch, sent };
}

export const noSleep = () => Promise.resolve();
