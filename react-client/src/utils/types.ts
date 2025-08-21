export type ScreenCoords = {
  screenX: number;
  screenY: number;
};

export type ServerMessage = {
  message: string;
  messageType: MessageType;
};

export enum MessageType {
  text,
  functionCall,
  audio
}