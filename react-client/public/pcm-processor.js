// public/pcm-processor.js
class PcmAudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    this.sampleRate = options.processorOptions.sampleRate; // sampleRate is global in worklet
    this.targetSampleRate = options.processorOptions.targetSampleRate || 16000;
    this.bufferSize = options.processorOptions.bufferSize || 4096 * 6; // Collect ~1.5s at 16kHz (4096*6 / 16000 = 1.536s)
    this.bytesPerSample = 2; // 16-bit PCM

    this._buffer = new Float32Array(this.bufferSize);
    this._bufferIndex = 0;
    this._isRecording = true; // Start recording immediately if worklet is active

    this.port.onmessage = (event) => {
      if (event.data.command === 'stop') {
        this._isRecording = false;
        this.flush(); // Send any remaining data
      } else if (event.data.command === 'start') {
        this._isRecording = true;
      }
    };
    this.port.postMessage({ type: 'WORKLET_READY' });
    console.log(`PcmAudioProcessor constructed. SampleRate: ${this.sampleRate}, TargetSR: ${this.targetSampleRate}, BufferSize: ${this.bufferSize}`);
  }

  // Basic downsampling (linear interpolation)
  downsample(buffer, inputSampleRate, outputSampleRate) {
     if (inputSampleRate === outputSampleRate) {
         return buffer;
     }
     const sampleRateRatio = inputSampleRate / outputSampleRate;
     const newLength = Math.round(buffer.length / sampleRateRatio);
     const result = new Float32Array(newLength);
     let offsetResult = 0;
     let offsetBuffer = 0;
     while (offsetResult < result.length) {
         const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
         let accum = 0, count = 0;
         for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
             accum += buffer[i];
             count++;
         }
         result[offsetResult] = count > 0 ? accum / count : 0; // Average, or 0 if no samples
         offsetResult++;
         offsetBuffer = nextOffsetBuffer;
     }
     return result;
 }


  process(inputs, outputs, parameters) {
    if (!this._isRecording) {
      return true; // Keep processor alive
    }

    const inputChannelData = inputs[0][0]; // Assuming mono input

    if (!inputChannelData || inputChannelData.length === 0) {
      return true;
    }

    // If microphone sample rate is different from target, downsample
    const processedData = this.downsample(inputChannelData, this.sampleRate, this.targetSampleRate);

    for (let i = 0; i < processedData.length; i++) {
      if (this._bufferIndex >= this.bufferSize) {
        this.flush();
      }
      this._buffer[this._bufferIndex++] = processedData[i];
    }
    return true;
  }

  flush() {
    if (this._bufferIndex === 0) return;

    const pcm16 = new Int16Array(this._bufferIndex);
    for (let i = 0; i < this._bufferIndex; i++) {
      let s = Math.max(-1, Math.min(1, this._buffer[i])); // Clamp
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; // Convert to 16-bit [-32768, 32767]
    }

    // Send the Int16Array directly. Base64 conversion will happen on the main thread.
    this.port.postMessage({ type: 'audioData', pcm16Data: pcm16 }, [pcm16.buffer]);
    this._bufferIndex = 0; // Reset buffer
  }
}

try {
  registerProcessor('pcm-audio-processor', PcmAudioProcessor);
} catch (e) {
  console.error('Error registering pcm-audio-processor', e);
}
