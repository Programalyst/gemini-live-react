// src/components/ScreenShareView.tsx
import React, { RefObject } from 'react';

interface ScreenShareViewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

const ScreenShareView: React.FC<ScreenShareViewProps> = ({ videoRef, canvasRef }) => {
  // When the component first renders, the <video> element doesn't exist in the DOM yet, so React sets videoRef.current to null. 
  // Only after the component mounts does React assign the actual DOM element to videoRef.current
  const videoWidth = videoRef.current?.videoWidth ?? 0;
  const videoHeight = videoRef.current?.videoHeight ?? 0;
  
  return (
    <div>
      <div className="video-container">
        <video className="video-area" ref={videoRef} autoPlay playsInline muted />
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
      <div>
        Screenshare Resolution: {videoWidth} x {videoHeight}
      </div>
    </div>
  );
};

export default ScreenShareView;