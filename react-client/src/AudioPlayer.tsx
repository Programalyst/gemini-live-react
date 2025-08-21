// src/AudioPlayer.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';

// The URL to your worklet file in the public folder
const PCM_PROCESSOR_URL = '/pcm-processor.js'; // Vite & CRA: '/filename.js' for files in public/

const AudioPlayer: React.FC = () => {
    const [isAudioInitialized, setIsAudioInitialized] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);

    const audioContextRef = useRef<AudioContext | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null); // For volume control

    const initializeAudio = useCallback(async () => {
        if (audioContextRef.current) {
            console.log("AudioContext already initialized.");
            setIsAudioInitialized(true);
            return;
        }

        try {
            console.log("Initializing AudioContext...");
            const context = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: 24000, // Match your worklet/data if specific
            });
            audioContextRef.current = context;

            console.log(`Attempting to add audio worklet module: ${PCM_PROCESSOR_URL}`);
            await context.audioWorklet.addModule(PCM_PROCESSOR_URL);
            console.log("Audio worklet module added.");

            const workletNode = new AudioWorkletNode(context, 'pcm-processor');
            workletNodeRef.current = workletNode;

            // Optional: Listen for messages from the worklet
            workletNode.port.onmessage = (event) => {
                if (event.data.type === 'WORKLET_READY') {
                    console.log("PCM Processor Worklet is ready.");
                }
                // Handle other messages if your worklet sends them
            };
            workletNode.port.onmessageerror = (event) => {
                console.error("Error from worklet port:", event);
                setError("Error from audio worklet port.");
            }


            const gainNode = context.createGain();
            gainNodeRef.current = gainNode;

            workletNode.connect(gainNode);
            gainNode.connect(context.destination);

            setIsAudioInitialized(true);
            setError(null);
            console.log("Audio system initialized successfully.");

        } catch (err) {
            console.error("Failed to initialize audio system:", err);
            setError(err instanceof Error ? err.message : String(err));
            setIsAudioInitialized(false);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            console.log("Cleaning up audio resources...");
            if (workletNodeRef.current) {
                workletNodeRef.current.port.onmessage = null; // Remove listener
                workletNodeRef.current.port.onmessageerror = null;
                workletNodeRef.current.disconnect();
                workletNodeRef.current = null;

            }
            if (gainNodeRef.current) {
                gainNodeRef.current.disconnect();
                gainNodeRef.current = null;
            }
            if (audioContextRef.current) {
                // Best practice: resume context before closing if it was suspended
                // then close, especially for user-initiated actions.
                audioContextRef.current.resume().then(() => {
                    audioContextRef.current?.close().then(() => {
                        console.log("AudioContext closed.");
                    }).catch(e => console.error("Error closing AudioContext:", e));
                    audioContextRef.current = null;
                }).catch(e => console.error("Error resuming AudioContext before close:", e));
            }
        };
    }, []);

    const sendPcmData = (pcmData: Float32Array) => {
        if (!workletNodeRef.current || !isAudioInitialized) {
            console.warn("Audio not initialized or worklet node not ready. Cannot send PCM data.");
            setError("Audio not ready. Initialize first.");
            return;
        }
        if (audioContextRef.current?.state === 'suspended') {
            console.warn("AudioContext is suspended. Resuming...");
            audioContextRef.current.resume().then(() => {
                 console.log("AudioContext resumed. Sending data.");
                 workletNodeRef.current?.port.postMessage(pcmData);
            }).catch(err => {
                console.error("Failed to resume AudioContext:", err);
                setError("Could not resume AudioContext to play audio.");
            });
        } else {
             workletNodeRef.current.port.postMessage(pcmData);
        }
    };

    const handlePlaySample = () => {
        // Create some dummy PCM data (e.g., a simple sine wave)
        // For a real app, this data would come from your audio source (file, microphone, network)
        const sampleRate = audioContextRef.current?.sampleRate || 24000;
        const duration = 1; // 1 second
        const frequency = 440; // A4 note
        const numSamples = sampleRate * duration;
        const samplePcm = new Float32Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
            samplePcm[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5; // 0.5 amplitude
        }
        console.log(`Sending ${samplePcm.length} PCM samples to worklet.`);
        sendPcmData(samplePcm);
        setIsPlaying(true); // You might want better state management for actual playback
        setTimeout(() => setIsPlaying(false), duration * 1000);
    };

    const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = parseFloat(event.target.value);
        }
    };

    return (
        <div>
            <h2>Audio Worklet Player</h2>
            {!isAudioInitialized && (
                <button onClick={initializeAudio} disabled={isAudioInitialized}>
                    Initialize Audio Engine
                </button>
            )}
            {isAudioInitialized && <p>Audio Engine Initialized (Sample Rate: {audioContextRef.current?.sampleRate} Hz)</p>}

            {isAudioInitialized && (
                <div>
                    <button onClick={handlePlaySample} disabled={isPlaying || !isAudioInitialized}>
                        {isPlaying ? "Playing..." : "Play Sample PCM"}
                    </button>
                    <div>
                        <label htmlFor="volume">Volume: </label>
                        <input
                            type="range"
                            id="volume"
                            min="0"
                            max="1"
                            step="0.01"
                            defaultValue="1"
                            onChange={handleVolumeChange}
                        />
                    </div>
                </div>
            )}
            {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        </div>
    );
};

export default AudioPlayer;
