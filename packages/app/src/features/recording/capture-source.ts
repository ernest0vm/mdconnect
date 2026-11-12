import type { BlockSource } from './capture';
import workletUrl from './capture.worklet.ts?worker&url';

/** A live capture of an input stream; `close` stops it and releases the input. */
export interface LiveCapture extends BlockSource {
  close(): Promise<void>;
}

/**
 * Starts delivering the stream's audio as blocks, at the input's own rate (so nothing is
 * resampled) and with its own channel count, stereo at most.
 */
export async function startCapture(stream: MediaStream): Promise<LiveCapture> {
  const track = stream.getAudioTracks()[0];
  const settings = track?.getSettings() ?? {};
  let context: AudioContext | undefined;
  const release = async () => {
    for (const each of stream.getTracks()) each.stop();
    await context?.close();
  };
  try {
    context = new AudioContext(
      settings.sampleRate === undefined ? {} : { sampleRate: settings.sampleRate },
    );
    await context.audioWorklet.addModule(workletUrl);
    const channels = Math.min(Math.max(settings.channelCount ?? 2, 1), 2);
    const capture = new AudioWorkletNode(context, 'mdconnect-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: channels,
      channelCountMode: 'explicit',
    });
    // Connected to the output through a muted gain so the audio graph keeps pulling the node.
    const mute = context.createGain();
    mute.gain.value = 0;
    const input = context.createMediaStreamSource(stream);
    input.connect(capture);
    capture.connect(mute);
    mute.connect(context.destination);

    const listeners = new Set<(block: Float32Array[]) => void>();
    capture.port.onmessage = (event: MessageEvent<Float32Array[]>) => {
      for (const listener of listeners) listener(event.data);
    };
    return {
      channels,
      sampleRate: context.sampleRate,
      onBlock(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      onEnded(listener) {
        // An input that ended before anyone listened fires no event, so it is reported here.
        let listening = true;
        const notify = () => {
          if (listening) listener();
        };
        if (track === undefined || track.readyState === 'ended') queueMicrotask(notify);
        else track.addEventListener('ended', notify);
        return () => {
          listening = false;
          track?.removeEventListener('ended', notify);
        };
      },
      async close() {
        listeners.clear();
        input.disconnect();
        capture.disconnect();
        await release();
      },
    };
  } catch (error) {
    // Nothing is returned to close, so the input and the context are released here.
    await release().catch(() => undefined);
    throw error;
  }
}
