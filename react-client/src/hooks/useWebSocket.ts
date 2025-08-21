// src/hooks/useWebSocket.ts
import { useState, useRef, useCallback, useEffect } from 'react';

export enum WebSocketStatus {
  Disconnected = "DISCONNECTED",
  Connecting = "CONNECTING",
  Connected = "CONNECTED",
  Error = "ERROR",
}

export const useWebSocket = (serverUrl: string) => {
  const [status, setStatus] = useState<WebSocketStatus>(WebSocketStatus.Disconnected);
  const webSocketRef = useRef<WebSocket | null>(null);

  const connect = useCallback((onMessageCallback: (data: any) => void) => {
    if (webSocketRef.current && webSocketRef.current.readyState !== WebSocket.CLOSED) {
      console.warn("WebSocket is already connected or connecting.");
      return;
    }

    setStatus(WebSocketStatus.Connecting);
    const ws = new WebSocket(serverUrl);
    webSocketRef.current = ws;

    ws.onopen = () => setStatus(WebSocketStatus.Connected);
    ws.onclose = () => setStatus(WebSocketStatus.Disconnected);
    ws.onerror = () => setStatus(WebSocketStatus.Error);
    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        onMessageCallback(data);
      } catch (e) {
        console.warn("Received non-JSON message:", event.data);
        onMessageCallback({ type: 'raw', content: event.data });
      }
    };
  }, [serverUrl]);

  const disconnect = useCallback(() => {
    if (webSocketRef.current) {
      webSocketRef.current.close(1000, "Client initiated disconnect");
      webSocketRef.current = null;
      setStatus(WebSocketStatus.Disconnected);
    }
  }, []);

  const sendMessage = useCallback((data: object) => {
    if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
      webSocketRef.current.send(JSON.stringify(data));
    } else {
      console.error("Cannot send message, WebSocket is not connected.");
    }
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);


  return { status, connect, disconnect, sendMessage };
};