// src/components/MediaControls.tsx
import React from 'react';

interface MediaControlsProps {
  isSharing: boolean;
  isRecording: boolean;
  onStartSharing: () => void;
  onStopSharing: () => void;
  onStartAudio: () => void;
  onStopAudio: () => void;
}

const MediaControls: React.FC<MediaControlsProps> = (props) => {
  const {
    isSharing, isRecording,
    onStartSharing, onStopSharing, onStartAudio, onStopAudio
  } = props;

  return (
    <div className="controls">
      {isSharing ? (
        <button onClick={onStopSharing}>Stop Sharing</button>
      ) : (
        <button onClick={onStartSharing}>Start Sharing</button>
      )}

      {isRecording ? (
        <button onClick={onStopAudio}>Stop Audio Capture</button>
      ) : (
        <button onClick={onStartAudio}>Start Audio Capture</button>
      )}
    </div>
  );
};

export default MediaControls;