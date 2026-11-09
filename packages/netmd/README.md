# @mdconnect/netmd

Read-only NetMD protocol code: the USB transport, the query encoder and decoder, and the queries needed to list a disc.

It is a TypeScript port of part of [netmd-js](https://github.com/cybercase/netmd-js) 4.4.1 by Stefano Brilli and Asivery, licensed under the GNU General Public License v2.0. Each ported file names its upstream source. Changes from upstream are listed in the file that makes them:

- Native `BigInt` replaces `jsbi`.
- Shift-JIS titles decode with `TextDecoder` instead of `jconv`.
- No logger and no encryption, because nothing here writes to or transfers from the disc.

See `openspec/changes/read-disc-contents/design.md` for why this is a port rather than a dependency.
