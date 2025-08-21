import React from 'react'
import { MessageType, ServerMessage } from "../utils/types"

interface MessageDisplayProps {
  serverMsg: ServerMessage;
  listItemKey: number;
}

const MessageDisplay: React.FC<MessageDisplayProps> = (props) => {
  return <p 
    className={props.serverMsg.messageType === MessageType.functionCall ? "server-message-fc" : "server-message"} 
    key={props.listItemKey}>{props.serverMsg.message}
  </p>
}

export default MessageDisplay