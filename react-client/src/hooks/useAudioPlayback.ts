// src/hooks/useAudioPlayback.ts
import { useRef, useCallback } from 'react';

export const useAudioPlayback = () => {
    const playbackAudioContextRef = useRef<AudioContext | null>(null);
    const audioQueueRef = useRef<ArrayBuffer[]>([]);
    const nextPlayTimeRef = useRef<number>(0);

    const initializePlayback = useCallback(() => {

        if (!playbackAudioContextRef.current) {
            try {
                const context = new (window.AudioContext || (window as any).webkitAudioContext)({
                    sampleRate: 24000 // IMPORTANT: Match Gemini's output sample rate
                });
                playbackAudioContextRef.current = context;
                console.log("Playback AudioContext initialized with 24kHz sample rate.");
            } catch (e) {
                console.error("Failed to initialize Playback AudioContext:", e);
            }
        }
    }, []);

    const processAudioQueue = useCallback(async () => {
    
        if (audioQueueRef.current.length === 0) {
            return; // Exit if already processing or queue is empty
        }

        const audioContext = playbackAudioContextRef.current;

        if (!audioContext) {
            console.error("Playback AudioContext not initialized.");
            return;
        }
        
        // Resume context if it was suspended (e.g., page was in background)
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        // Process all chunks currently in the queue
        while (audioQueueRef.current.length > 0) {
            const audioChunk = audioQueueRef.current.shift();
            if (!audioChunk) continue;

            try {
                // Gemini sends raw 16-bit PCM data. We need to convert it to 32-bit float
                // that the Web Audio API uses.
                const pcmData = new Int16Array(audioChunk);
                const float32Data = new Float32Array(pcmData.length);
                for (let i = 0; i < pcmData.length; i++) {
                    float32Data[i] = pcmData[i] / 32768; // Convert to range [-1.0, 1.0]
                }
                
                // Create an AudioBuffer
                const audioBuffer = audioContext.createBuffer(
                    1,                      // 1 channel (mono)
                    float32Data.length,     // buffer length
                    audioContext.sampleRate // sample rate (24000)
                );
                
                // Fill the buffer with our data
                audioBuffer.copyToChannel(float32Data, 0);

                // Create a source node to play the buffer
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContext.destination);

                // Schedule playback to avoid gaps and clicks
                const currentTime = audioContext.currentTime;
                const startTime = Math.max(currentTime, nextPlayTimeRef.current);
                source.start(startTime);

                // Update the time for the next chunk to start
                nextPlayTimeRef.current = startTime + audioBuffer.duration;

            } catch (e) {
                console.error("Error processing audio chunk:", e);
            }
        }

    }, []); // useCallback with empty dependency array

    return {
        audioQueueRef,
        initializePlayback,
        processAudioQueue,
    };

}