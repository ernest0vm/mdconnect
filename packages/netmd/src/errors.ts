/*
 * Ported from netmd-js 4.4.1, src/netmd-shared-objects.ts
 * (https://github.com/cybercase/netmd-js), by Stefano Brilli and Asivery, GPL-2.0.
 * `NetMdTimeoutError` is new: upstream waits for a reply without a limit.
 */

export class NetMdError extends Error {
  override name = 'NetMdError';
}

/** The device answered "not implemented" to a command. */
export class NetMdNotImplementedError extends NetMdError {
  override name = 'NetMdNotImplementedError';
}

/** The device rejected a command, or kept answering "interim". */
export class NetMdRejectedError extends NetMdError {
  override name = 'NetMdRejectedError';
}

/** The device produced no reply within the time limit. */
export class NetMdTimeoutError extends NetMdError {
  override name = 'NetMdTimeoutError';
}
