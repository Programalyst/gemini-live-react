// src/hooks/useScreenShare.ts
import { useState, useRef, useCallback } from 'react';

export const useScreenShare = () => {
  const [isSharing, setIsSharing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const b64FrameRef = useRef<string>('');
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const captureFrame = useCallback(() => {

    if (!videoRef.current || !canvasRef.current || !streamRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    //console.log("CaptureFrame: Capturing frame with dimensions:", canvas.width, "x", canvas.height);
    
    const context = canvas.getContext("2d");
    if (!context) return;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    b64FrameRef.current = canvas.toDataURL("image/jpeg").split(",")[1].trim();
  }, []);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    setIsSharing(false);
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: "screen" } as MediaTrackConstraints,
        audio: false
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setIsSharing(true);
      captureIntervalRef.current = setInterval(captureFrame, 1000);

      stream.getVideoTracks()[0].onended = () => stop();

    } catch (err) {
      console.error("Error starting screen share:", err);
      setIsSharing(false);
    }
  }, [captureFrame, stop]);

  return {
    isSharing,
    videoRef,
    canvasRef,
    b64FrameRef: b64FrameRef,
    startSharing: start,
    stopSharing: stop,
  };
};