class Pcm16CaptureProcessor
  extends AudioWorkletProcessor {
  constructor(options) {
    super();

    this.targetRate =
      options.processorOptions?.targetRate
      || 16000;

    this.ratio =
      sampleRate / this.targetRate;

    this.buffer = [];
  }

  process(inputs) {
    const input = inputs[0]?.[0];

    if (!input) {
      return true;
    }

    for (
      let offset = 0;
      offset < input.length;
      offset += this.ratio
    ) {
      const start = Math.floor(offset);

      const end = Math.min(
        input.length,
        Math.floor(offset + this.ratio),
      );

      let sum = 0;

      for (
        let index = start;
        index < end;
        index += 1
      ) {
        sum += input[index];
      }

      const average =
        sum / Math.max(1, end - start);

      const clamped = Math.max(
        -1,
        Math.min(1, average),
      );

      this.buffer.push(
        clamped < 0
          ? clamped * 32768
          : clamped * 32767,
      );
    }

    if (this.buffer.length >= 512) {
      const samples = new Int16Array(
        this.buffer.splice(0, 512),
      );

      this.port.postMessage(
        samples.buffer,
        [samples.buffer],
      );
    }

    return true;
  }
}

registerProcessor(
  "pcm16-capture",
  Pcm16CaptureProcessor,
);
