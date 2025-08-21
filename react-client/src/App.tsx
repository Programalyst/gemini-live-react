// src/App.tsx
import React, { useState, useCallback } from "react";
import "./App.css";
import { ServerMessage, MessageType } from "./utils/types";
import { useWebSocket } from "./hooks/useWebSocket";
import { useScreenShare } from "./hooks/useScreenShare";
import { useAudioCapture } from "./hooks/useAudioCapture";
import { useAudioPlayback } from "./hooks/useAudioPlayback";
import { base64ToArrayBuffer } from "./utils/helpers";

// UI Components
import ConnectionControls from "./components/ConnectionControls";
import MediaControls from "./components/MediaControls";
import ScreenShareView from "./components/ScreenShareView";
import MessageDisplay from "./components/MessageDisplay";

const SERVER_URL = "ws://localhost:9080/video_stream";

const App: React.FC = () => {
  const [serverMessages, setServerMessages] = useState<ServerMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  
  // --- Custom Hooks ---
  const {
    status: wsStatus,
    connect: connectWebSocket,
    disconnect: disconnectWebSocket,
    sendMessage,
  } = useWebSocket(SERVER_URL);

  const {
    isSharing,
    videoRef,
    canvasRef,
    b64FrameRef,
    startSharing,
    stopSharing,
  } = useScreenShare();

  const {
    audioQueueRef,
    initializePlayback,
    processAudioQueue
  } = useAudioPlayback();

  const handleAudioData = useCallback((base64Audio: string) => {
    const payload = {
      realtime_input: {
        media_chunks: [
          { mime_type: "audio/pcm", data: base64Audio },
          { mime_type: "image/jpeg", data: b64FrameRef.current },
        ],
      },
    };
    //console.log("Sending audio data:", base64Audio.substring(0, 10));
    //console.log("Sending frame data:", b64FrameRef ? b64FrameRef.current.substring(0, 10) : "No frame data");
    // Gemini API will disconnect session if empty b64frame data (i.e. '') is sent
    sendMessage(payload);
  }, [b64FrameRef, sendMessage]);

  const {
    isRecording,
    initializeAudio,
    startAudio,
    stopAudio,
  } = useAudioCapture(handleAudioData);

  // Handle the possible responses from Gemini / the server
  const handleWebSocketMessage = useCallback((data: any) => {
    //console.log("Message from server:", data);
    if (data && data.type === "text") {
        const newMessage: ServerMessage = { message: data.content, messageType: MessageType.text}
        setServerMessages(prev => [newMessage, ...prev]);
    } else if (data && data.type === "function_call" && data.content) {
        const newMessage: ServerMessage = { 
            message: `function call: ${JSON.stringify(data.content)}`, 
            messageType: MessageType.functionCall
        }
        setServerMessages(prevMessages => [newMessage, ...prevMessages]);
    } else if (data && data.type === "audio" && data.audio) {
        // 1. Decode the Base64 audio data into an ArrayBuffer
        const audioChunk = base64ToArrayBuffer(data.audio);
        // 2. Add the chunk to our queue
        audioQueueRef.current.push(audioChunk);
        // 3. Trigger the playback processor
        processAudioQueue();
    }
  }, [audioQueueRef, processAudioQueue]);

  const handleConnect = () => {
    setServerMessages([]);
    connectWebSocket(handleWebSocketMessage);
    initializeAudio();
    initializePlayback();
  }

  // --- UI Event Handlers ---
  const sendTextAndImage = () => {
    const payload = {
      image_text: [
        { mime_type: "image/jpeg", data: b64FrameRef.current },
        { mime_type: "text/plain", data: inputValue },
      ],
    };
    sendMessage(payload);
  };
  
  return (
    <div className="App">
      <div className="screen-share">
        <ConnectionControls
          status={wsStatus}
          onConnect={handleConnect}
          onDisconnect={disconnectWebSocket}
        />

        <MediaControls
          isSharing={isSharing}
          isRecording={isRecording}
          onStartSharing={startSharing}
          onStopSharing={stopSharing}
          onStartAudio={startAudio}
          onStopAudio={stopAudio}
        />
        
        <ScreenShareView videoRef={videoRef} canvasRef={canvasRef} />

        <div className="text-prompt-area">
          <input 
             className="prompt-input" 
             type="text" 
             placeholder="Prompt..." 
             value={inputValue} 
             onChange={(e) => setInputValue(e.target.value)}
          />
          <button onClick={sendTextAndImage} disabled={!isSharing}>Send text+frame</button>
        </div>
      </div>
      
      <div className="server-message-display">
        {serverMessages.map((msg, index) => <MessageDisplay key={index} listItemKey={index} serverMsg={msg}/>)}
      </div>
    </div>
  );
};

export default App;