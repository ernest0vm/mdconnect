#!/usr/bin/env bash
# Rebuilds atracdenc.mjs, the WebAssembly build of atracdenc that encodes LP2 and LP4 in the app,
# from pinned sources. Needs Docker. Run from anywhere: ./packages/app/vendor/atracdenc/build.sh
#
# atracdenc (https://github.com/dcherednik/atracdenc) and libsndfile
# (https://github.com/libsndfile/libsndfile) are LGPL-2.1; see README.md and LICENSE in this folder.
set -euo pipefail

EMSDK_IMAGE="emscripten/emsdk:6.0.10"
ATRACDENC_COMMIT="cb170709f836cb43dc0312455188c791159d81dc"
LIBSNDFILE_COMMIT="72f6af15e8f85157bd622ed45b979025828b7001" # 1.2.2

out_dir="$(cd "$(dirname "$0")" && pwd)"

docker run --rm \
  -v "$out_dir":/out \
  -e ATRACDENC_COMMIT="$ATRACDENC_COMMIT" \
  -e LIBSNDFILE_COMMIT="$LIBSNDFILE_COMMIT" \
  "$EMSDK_IMAGE" bash -euo pipefail -c '
    cd /tmp

    git clone --quiet https://github.com/libsndfile/libsndfile.git
    git -C libsndfile checkout --quiet "$LIBSNDFILE_COMMIT"
    emcmake cmake -S libsndfile -B sndfile-build -DCMAKE_BUILD_TYPE=Release \
      -DBUILD_SHARED_LIBS=OFF -DBUILD_PROGRAMS=OFF -DBUILD_EXAMPLES=OFF -DBUILD_TESTING=OFF \
      -DENABLE_EXTERNAL_LIBS=OFF -DENABLE_MPEG=OFF -DENABLE_CPACK=OFF \
      -DCMAKE_INSTALL_PREFIX=/tmp/sndfile >/dev/null
    cmake --build sndfile-build --target install -j"$(nproc)" >/dev/null

    git clone --quiet https://github.com/dcherednik/atracdenc.git
    git -C atracdenc checkout --quiet "$ATRACDENC_COMMIT"
    git -C atracdenc submodule update --quiet --init --recursive
    # WebAssembly is little-endian; the endianness probe cannot run under Emscripten.
    sed -i "s/^TEST_BIG_ENDIAN(BIGENDIAN_ORDER)$/set(BIGENDIAN OFF)/" atracdenc/src/CMakeLists.txt

    # MODULARIZE + EXPORT_ES6: a module factory a worker can import. SINGLE_FILE embeds the wasm.
    # DYNAMIC_EXECUTION=0: no eval or new Function, which the Content Security Policy forbids.
    link_flags="-O3 -g0 -sMODULARIZE=1 -sEXPORT_ES6=1 -sSINGLE_FILE=1 -sENVIRONMENT=worker \
      -sINVOKE_RUN=0 -sEXIT_RUNTIME=0 -sALLOW_MEMORY_GROWTH=1 -sDYNAMIC_EXECUTION=0 \
      -sEXPORTED_RUNTIME_METHODS=callMain,FS -sEXPORT_NAME=createAtracdenc"
    emcmake cmake -S atracdenc/src -B atracdenc-build -DCMAKE_BUILD_TYPE=Release \
      -DATRACDENC_PCM_IO_BACKEND=libsndfile \
      -DLIBSNDFILE_INCLUDE_DIR=/tmp/sndfile/include -DSNDFILE_LIBRARY=/tmp/sndfile/lib/libsndfile.a \
      -DCMAKE_CXX_FLAGS="-O3" -DCMAKE_C_FLAGS="-O3" \
      -DCMAKE_EXE_LINKER_FLAGS="$link_flags" >/dev/null
    cmake --build atracdenc-build --target atracdenc -j"$(nproc)" >/dev/null

    # Emscripten names the output .js; it is an ES module.
    cp atracdenc-build/atracdenc.js /out/atracdenc.mjs
    cp atracdenc/LICENSE /out/LICENSE
  '

echo "Built $out_dir/atracdenc.mjs ($(wc -c <"$out_dir/atracdenc.mjs") bytes)"
