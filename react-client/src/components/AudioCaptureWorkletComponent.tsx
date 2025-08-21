import React, { useState, useRef, useEffect, useCallback } from 'react';

const PCM_PROCESSOR_URL = '/pcm-processor.js';
const TARGET_SAMPLE_RATE = 16000;
const WORKLET_PROCESSOR_NAME = 'pcm-audio-processor'; // Must match registerProcessor name

const AudioCaptureWorkletComponent: React.FC = () => {
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isAudioSystemReady, setIsAudioSystemReady] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const audioContextRef = useRef<AudioContext | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const userMediaStreamRef = useRef<MediaStream | null>(null);

    // Function to convert Int16Array PCM to Base64
    const pcm16ToBase64 = useCallback((pcm16Data: Int16Array): string => {
        const buffer = pcm16Data.buffer; // Get the underlying ArrayBuffer
        const uint8ArrayInstance = new Uint8Array(buffer);

        let binaryString = '';
        const chunkSize = 8192; // Mitigate String.fromCharCode call stack limits
        for (let i = 0; i < uint8ArrayInstance.length; i += chunkSize) {
            const chunk = uint8ArrayInstance.subarray(i, i + chunkSize);
            binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        try {
            return btoa(binaryString);
        } catch (e) {
            console.error("Error in btoa during pcm16ToBase64:", e);
            return "";
        }
    }, []);


    const initializeAudioSystem = useCallback(async () => {
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            console.log("AudioContext already initialized and not closed.");
            // If already initialized, ensure worklet node is also ready or re-evaluate
            if (workletNodeRef.current) {
                 setIsAudioSystemReady(true); // Assume ready if context and node exist
            }
            return;
        }
        setError(null);

        try {
            console.log("Initializing AudioContext for Worklet...");
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            // The actual sampleRate of the context might differ from what microphone provides.
            // The worklet will receive audio at context.sampleRate.
            audioContextRef.current = context;

            console.log(`Attempting to add audio worklet module: ${PCM_PROCESSOR_URL}`);
            await context.audioWorklet.addModule(PCM_PROCESSOR_URL);
            console.log("Audio worklet module added.");

            const workletNode = new AudioWorkletNode(context, WORKLET_PROCESSOR_NAME, {
                processorOptions: {
                    sampleRate: context.sampleRate, // Pass actual context SR to worklet
                    targetSampleRate: TARGET_SAMPLE_RATE,
                    // bufferSize:  // default = 4096 * 6 if not set
                }
            });
            workletNodeRef.current = workletNode;

            workletNode.port.onmessage = (event) => {
                if (event.data.type === 'WORKLET_READY') {
                    console.log(`PCM Audio Processor Worklet is ready. Context SR: ${context.sampleRate}`);
                    setIsAudioSystemReady(true);
                } else if (event.data.type === 'audioData' && event.data.pcm16Data) {
                    const pcm16Array = event.data.pcm16Data as Int16Array;
                    const base64Audio = pcm16ToBase64(pcm16Array);
                    if (base64Audio) {
                        console.log(`Base64 (from Worklet, ${pcm16Array.length} samples @${TARGET_SAMPLE_RATE}Hz): ${base64Audio.substring(0, 60)}...`);
                        // sendVoiceMessage(base64Audio); // Your function to send data
                    }
                }
            };
            workletNode.port.onmessageerror = (errEvent) => { // Note: onmessageerror is the correct event name
                console.error("Error message from worklet port:", errEvent);
                setError("An error occurred in the worklet's message port.");
            };

             // The worklet node is created, but not yet connected to mic or destination.
             // It will be connected in startRecording.
             // We don't connect to destination unless we want to hear the raw mic input through worklet.

        } catch (err) {
            console.error("Failed to initialize audio system with Worklet:", err);
            setError(err instanceof Error ? err.message : String(err));
            setIsAudioSystemReady(false);
        }
    }, [pcm16ToBase64]);


    const startRecording = useCallback(async () => {
        if (!isAudioSystemReady || !audioContextRef.current || !workletNodeRef.current) {
            setError("Audio system not ready. Please initialize first.");
            console.log("Attempting to initialize audio system before starting recording...");
            await initializeAudioSystem(); // Try to initialize if not ready
            // Re-check after initialization attempt
            if (!isAudioSystemReady || !audioContextRef.current || !workletNodeRef.current) {
                setError("Audio system failed to initialize. Cannot start recording.");
                return;
            }
        }
        if (isRecording) {
            console.warn("Already recording.");
            return;
        }
        setError(null);

        const context = audioContextRef.current;
        const workletNode = workletNodeRef.current;

        try {
            // Resume context if suspended (important for user interaction requirement)
            if (context.state === 'suspended') {
                await context.resume();
                console.log("AudioContext resumed.");
            }

            console.log("Requesting microphone access...");
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    // We don't strictly need to request targetSampleRate here,
                    // as downsampling can happen in worklet.
                    // But if browser can provide it, it might be slightly more efficient.
                    // sampleRate: TARGET_SAMPLE_RATE, // Optional: request preferred SR
                    channelCount: 1,
                    echoCancellation: true, // Good defaults
                    noiseSuppression: true,
                },
                video: false
            });
            userMediaStreamRef.current = stream;

            const source = context.createMediaStreamSource(stream);
            mediaStreamSourceRef.current = source;

            source.connect(workletNode);
            // Only connect worklet to destination if you want to hear the processed audio.
            // For just capturing, this is not strictly necessary.
            // workletNode.connect(context.destination);

            workletNode.port.postMessage({ command: 'start' }); // Tell worklet to start processing
            setIsRecording(true);
            console.log("Recording started with AudioWorklet.");

        } catch (err) {
            console.error("Error starting recording with Worklet:", err);
             if (err instanceof DOMException) {
                 if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                    setError("Microphone permission denied.");
                } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                    setError("No microphone found.");
                } else {
                    setError(`Error accessing microphone: ${err.message}`);
                }
            } else {
                 setError("An unknown error occurred while starting recording.");
            }
            setIsRecording(false);
        }
    }, [isAudioSystemReady, isRecording, initializeAudioSystem]);


    const stopRecording = useCallback(() => {
        if (!isRecording) {
            console.warn("Not currently recording.");
            return;
        }
        console.log("Stopping recording (AudioWorklet)...");

        workletNodeRef.current?.port.postMessage({ command: 'stop' }); // Tell worklet to flush and stop

        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if (userMediaStreamRef.current) {
            userMediaStreamRef.current.getTracks().forEach(track => track.stop());
            userMediaStreamRef.current = null;
        }
        // Do not close the AudioContext here if you plan to record again.
        // Only close it on component unmount or if explicitly done with audio.
        // If you want to allow multiple start/stop cycles, keep context alive.
        // audioContextRef.current?.suspend(); // Or suspend it

        setIsRecording(false);
        console.log("Recording stopped.");
    }, [isRecording]);

    // Effect for initial audio system setup (e.g., on component mount or button click)
    useEffect(() => {
        // Initialize audio system when component mounts, or you can tie this to a button
        // initializeAudioSystem(); // Auto-initialize on mount

        // Cleanup audio resources on component unmount
        return () => {
            console.log("Cleaning up AudioCaptureWorkletComponent...");

            workletNodeRef.current?.port.close(); // Close the MessageChannel port
            workletNodeRef.current?.disconnect();
            workletNodeRef.current = null;

            mediaStreamSourceRef.current?.disconnect();
            mediaStreamSourceRef.current = null;

            userMediaStreamRef.current?.getTracks().forEach(track => track.stop());
            userMediaStreamRef.current = null;

            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close()
                    .then(() => console.log("AudioContext closed on unmount."))
                    .catch(e => console.error("Error closing AudioContext on unmount:", e));
                audioContextRef.current = null;
            }
        };
    }, []); 

    return (
        <div>
            <h2>Audio Capture (AudioWorklet)</h2>
            {!isAudioSystemReady && (
                <button onClick={initializeAudioSystem} disabled={isAudioSystemReady}>
                    Initialize Audio System
                </button>
            )}
            {isAudioSystemReady && !isRecording && (
                <button onClick={startRecording} disabled={!isAudioSystemReady || isRecording}>
                    Start Recording
                </button>
            )}
            {isRecording && (
                <button onClick={stopRecording} disabled={!isRecording}>
                    Stop Recording
                </button>
            )}

            {isAudioSystemReady && <p>Audio System Ready ✅</p>}
            {isRecording && <p>🔴 Recording audio... Check console for Base64 logs.</p>}
            {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        </div>
    );
};

export default AudioCaptureWorkletComponent;

