/// <reference lib="webworker" />
/**
 * Runs in the audio rendering thread: forwards the captured input to the page in batches of
 * about 2,048 frames, one float array per channel.
 */

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, processor: typeof AudioWorkletProcessor): void;

const BATCH_FRAMES = 2048;

class CaptureProcessor extends AudioWorkletProcessor {
  private batch: Float32Array[][] = [];
  private frames = 0;

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0];
    if (input === undefined || input.length === 0) return true;
    this.batch.push(input.map((channel) => channel.slice()));
    this.frames += input[0]?.length ?? 0;
    if (this.frames >= BATCH_FRAMES) this.flush();
    return true;
  }

  private flush(): void {
    const channels = this.batch[0]?.length ?? 0;
    const merged = Array.from({ length: channels }, (_, channel) => {
      const samples = new Float32Array(this.frames);
      let offset = 0;
      for (const block of this.batch) {
        const part = block[channel] ?? new Float32Array(0);
        samples.set(part, offset);
        offset += part.length;
      }
      return samples;
    });
    this.port.postMessage(
      merged,
      merged.map((samples) => samples.buffer),
    );
    this.batch = [];
    this.frames = 0;
  }
}

registerProcessor('mdconnect-capture', CaptureProcessor);
