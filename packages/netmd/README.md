# @mdconnect/netmd

NetMD protocol code: the USB transport, the query encoder and decoder, the queries needed to list a disc, and the commands that edit titles, erase and move tracks, and store groups.

It is a TypeScript port of part of [netmd-js](https://github.com/cybercase/netmd-js) 4.4.1 by Stefano Brilli and Asivery, licensed under the GNU General Public License v2.0. Each ported file names its upstream source. Changes from upstream are listed in the file that makes them:

- Native `BigInt` replaces `jsbi`.
- Shift-JIS titles decode with `TextDecoder` instead of `jconv`, and encode with a table built from that decoder (`sjis.ts`).
- Accents are stripped with Unicode decomposition instead of the `diacritics` package (`sanitize.ts`).
- No logger and no encryption, because nothing here transfers audio.

Callers convert titles with `sanitizeHalfWidthTitle` or `sanitizeFullWidthTitle` before writing them. The write commands encode exactly what they are given and throw on a character Shift-JIS cannot store.

See `openspec/changes/archive/2026-11-09-read-disc-contents/design.md` for why this is a port rather than a dependency, and `openspec/changes/edit-disc/design.md` for the write path.
