# atracdenc (WebAssembly build)

`atracdenc.mjs` is [atracdenc](https://github.com/dcherednik/atracdenc) by Daniil Cherednik,
an open-source ATRAC1/ATRAC3/ATRAC3plus encoder, compiled to WebAssembly with Emscripten and
linked with [libsndfile](https://github.com/libsndfile/libsndfile). Both are licensed under the
GNU Lesser General Public License v2.1 (`LICENSE`, copied from atracdenc). mdconnect uses it in a
Web Worker to encode LP2 and LP4 offline (`src/features/upload/atracdenc.worker.ts`).

| Source     | Commit                                             |
| ---------- | -------------------------------------------------- |
| atracdenc  | `cb170709f836cb43dc0312455188c791159d81dc`         |
| libsndfile | `72f6af15e8f85157bd622ed45b979025828b7001` (1.2.2) |
| Emscripten | Docker image `emscripten/emsdk:6.0.10`             |

## Rebuilding

`build.sh` clones both sources at those commits inside the Emscripten Docker image, builds them
and copies `atracdenc.mjs` and `LICENSE` here. It needs Docker, and only to rebuild: the built
file is committed, so the app, its tests and its builds do not. The build is reproducible: running
it again gives a byte-identical file (SHA-256
`e517fa25bf1000a2e722555bc0fee016ce4e4858f6290fdbe99413d8f3f14412`).

The link flags keep the module safe under the app's Content Security Policy:
`DYNAMIC_EXECUTION=0` removes every `eval` and `new Function`, and `SINGLE_FILE` embeds the
WebAssembly so nothing is fetched. `atracdenc.d.mts` types the part of the module the worker uses.
