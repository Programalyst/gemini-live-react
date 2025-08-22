// src/hooks/useAudioCapture.ts
import { useState, useRef, useCallback, useEffect } from 'react';
import { pcm16ToBase64Async } from "../utils/helpers";

const PCM_PROCESSOR_URL = '/pcm-processor.js';

export const useAudioCapture = (onAudioData: (base64: string) => void) => {
    const [isInitialized, setIsInitialized] = useState(false);
    const [isRecording, setIsRecording] = useState(false);

    const audioContextRef = useRef<AudioContext | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const audioStreamRef = useRef<MediaStream | null>(null);

    const initialize = useCallback(async () => {
        if (audioContextRef.current) return;
        try {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = context;

            await context.audioWorklet.addModule(PCM_PROCESSOR_URL);
            const workletNode = new AudioWorkletNode(context, 'pcm-audio-processor', {
                processorOptions: { sampleRate: context.sampleRate, targetSampleRate: 24000 }
            });
            workletNodeRef.current = workletNode;

            workletNode.port.onmessage = async (event) => {
                if (event.data.type === 'audioData' && event.data.pcm16Data) {
                    const base64Audio = await pcm16ToBase64Async(event.data.pcm16Data);
                    if (base64Audio) {
                        onAudioData(base64Audio);
                    }
                }
            };
            setIsInitialized(true);
        } catch (err) {
            console.error("Failed to initialize audio:", err);
            setIsInitialized(false);
        }
    }, [onAudioData]);
    
    const start = useCallback(async () => {
        if (!isInitialized || !audioContextRef.current || !workletNodeRef.current) return;
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
        audioStreamRef.current = stream;
        const source = audioContextRef.current.createMediaStreamSource(stream);
        micSourceRef.current = source;
        source.connect(workletNodeRef.current);
        workletNodeRef.current.port.postMessage({ command: 'start' });
        setIsRecording(true);
    }, [isInitialized]);

    const stop = useCallback(() => {
        workletNodeRef.current?.port.postMessage({ command: 'stop' });
        micSourceRef.current?.disconnect();
        audioStreamRef.current?.getTracks().forEach(track => track.stop());
        micSourceRef.current = null;
        audioStreamRef.current = null;
        setIsRecording(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
      const context = audioContextRef.current;
      return () => {
        stop();
        context?.close();
      }
    }, [stop]);

    return { isAudioInitialized: isInitialized, isRecording, initializeAudio: initialize, startAudio: start, stopAudio: stop };
};