import asyncio
import websockets
from websockets.exceptions import ConnectionClosedOK, ConnectionClosedError, ConnectionClosed
import os
import json
import base64

from google import genai
from google.genai import types

from toolDeclarations import clickScreenPosition

from dotenv import load_dotenv
load_dotenv() # Load environment variables from .env file

import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL_NAME = "models/gemini-2.0-flash-live-001"

client = genai.Client(api_key=GEMINI_API_KEY, http_options={"api_version": "v1beta"})

gemini_config = types.LiveConnectConfig(
  response_modalities=["AUDIO"],
  tools=[{"function_declarations": [clickScreenPosition]}],
  temperature=0
)

async def send_to_gemini(client_websocket: websockets.ServerProtocol, session) -> None:
    try:
        async for message in client_websocket:
            try:
                data = json.loads(message)
                #logging.info(data)
                if "realtime_input" in data:

                    for chunk in data["realtime_input"]["media_chunks"]:
                        if chunk["mime_type"] == "audio/pcm":
                            audio_bytes = base64.b64decode(chunk["data"])
                            await session.send_realtime_input(
                                audio=types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000"))
                            
                        elif chunk["mime_type"] == "image/jpeg":
                            video_bytes = base64.b64decode(chunk["data"])
                            await session.send_realtime_input(
                                video=types.Blob(data=video_bytes, mime_type="image/jpeg"))
                            
            except Exception as e:
                logging.error(f"Error sending to Gemini: {e}")

        logging.info("Client connection closed (send)")
    except Exception as e:
            logging.error(f"Error sending to Gemini: {e}")

async def receive_from_gemini(client_websocket: websockets.ServerProtocol, session) -> None:

    while True: # outer loop needed to be able to handle consecutive responses

        async for response in session.receive():
            if getattr(response, 'usage_metadata', False):
                logging.info(f"Usage metadata: {response.usage_metadata}") # will display prompt and response token count
                continue  # Skip to next iteration if turn is complete

            # handle audio responses
            if response.data is not None:
                # 1. Encode the raw audio bytes to a Base64 string.
                base64_audio = base64.b64encode(response.data).decode('utf-8')
                
                # 2. Create a JSON payload. The key 'audio' matches what the frontend will expect.
                payload = json.dumps({
                    "type": "audio", 
                    "audio": base64_audio, 
                })

                # 3. Send the JSON payload to the client.
                await client_websocket.send(payload)

# Handles incoming WebSocket connections from clients
async def session_handler(client_websocket: websockets.ServerProtocol) -> None:
    
    # Get client address and path from the websocket object
    client_host = ""
    client_port = ""
    if client_websocket.remote_address: # remote_address is a tuple (host, port)
        client_host = client_websocket.remote_address[0]
        client_port = client_websocket.remote_address[1]
    
    request_path = client_websocket.request.path
    
    logging.info(f"Client {client_host}:{client_port} connected to WebSocket path: {request_path}")

    try:
        
        # Establish a new Gemini live session for this WebSocket connection
        async with client.aio.live.connect(model=GEMINI_MODEL_NAME, config=gemini_config) as session:

            logging.info(f"Client {client_host}:{client_port}: Gemini live session established successfully.")

            # Start send/receive loop - must contain a loop to keep gemini_session alive
            send_task = asyncio.create_task(send_to_gemini(client_websocket, session))
            receive_task = asyncio.create_task(receive_from_gemini(client_websocket, session))
            await asyncio.gather(send_task, receive_task)


    except ConnectionClosedOK:
        logging.info(f"Client {client_host}:{client_port} disconnected normally (ConnectionClosedOK). Code: {client_websocket.close_code}, Reason: '{client_websocket.close_reason}'")
    except Exception as e_loop:
        logging.error(f"Client {client_host}:{client_port}: Error in WebSocket handler loop: {e_loop}", exc_info=True)
    finally:
        logging.info(f"Client {client_host}:{client_port}: WebSocket handler for path '{request_path}' finishing.")
        if not client_websocket.close:
            try:
                await client_websocket.close(code=1000, reason="Server handler session finished")
                logging.info(f"Client {client_host}:{client_port}: Server explicitly closed WebSocket.")
            except ConnectionClosed: # Handles if already closed during the await
                logging.info(f"Client {client_host}:{client_port}: Connection was already closed when attempting explicit close in finally.")
            except RuntimeError as e_runtime: # e.g. sending on a closing connection
                logging.warning(f"Client {client_host}:{client_port}: Runtime error closing WebSocket in finally: {e_runtime}")

async def main_server_loop() -> None:
    """Starts the WebSocket server."""
    host = "0.0.0.0"
    port = 9080
    # websockets.serve will pass each new connection to session_handler
    async with websockets.serve(session_handler, host, port):
        logging.info(f"Asyncio WebSocket server started on ws://{host}:{port}")
        await asyncio.Future()  # Run forever until CancelledError (e.g., by Ctrl+C)

if __name__ == "__main__":
    try:
        asyncio.run(main_server_loop())
    except KeyboardInterrupt:
        logging.info("Server shutting down...")
