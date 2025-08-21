// src/components/ConnectionControls.tsx
import React from 'react';
import { WebSocketStatus } from '../hooks/useWebSocket';

interface ConnectionControlsProps {
  status: WebSocketStatus;
  onConnect: () => void;
  onDisconnect: () => void;
}

const statusDisplayMap: Record<WebSocketStatus, string> = {
  [WebSocketStatus.Connected]: "Connected",
  [WebSocketStatus.Connecting]: "Connecting...",
  [WebSocketStatus.Disconnected]: "Disconnected",
  [WebSocketStatus.Error]: "Connection Error",
};

const ConnectionControls: React.FC<ConnectionControlsProps> = ({ status, onConnect, onDisconnect }) => {
  return (
    <div className="connection-controls">
      <button onClick={onConnect} disabled={status === WebSocketStatus.Connected || status === WebSocketStatus.Connecting}>
        Connect to Server
      </button>
      <button onClick={onDisconnect} disabled={status === WebSocketStatus.Disconnected || status === WebSocketStatus.Error}>
        Disconnect from Server
      </button>
      <div className="connection-status">
        Websocket status: {statusDisplayMap[status]}
      </div>
    </div>
  );
};

export default ConnectionControls;