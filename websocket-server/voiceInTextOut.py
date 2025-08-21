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
  response_modalities=["TEXT"],
  tools=[{"function_declarations": [clickScreenPosition]}],
  temperature=0
)

async def send_to_gemini(client_websocket: websockets.ServerProtocol, session) -> None:
    """Sends messages from the client websocket to the Gemini API."""
    try:
        async for message in client_websocket:
            try:
                data = json.loads(message)
                if "realtime_input" in data:
                    logging.info("realtime data received from client")
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
    """Receives responses from the Gemini API and forwards them to the client, looping until turn is complete."""

    while True: # outer loop needed to be able to handle consecutive responses

        async for response in session.receive():

            if response.text is not None:
                logging.info(f"Received text from Gemini: {response.text}")
                payload = json.dumps({"type": "text", "content": str(response.text)})
                await client_websocket.send(payload)
                
            # handle tool calls
            if response.tool_call:
                function_responses = []
                for fc in response.tool_call.function_calls:
                    function_response = types.FunctionResponse(
                        id=fc.id,
                        name=fc.name,
                        response={ "result": "ok" } # simple, hard-coded function response
                    )
                    function_responses.append(function_response)
                
                await client_websocket.send(json.dumps({
                    "type": "function_call", 
                    "content": response.tool_call.function_calls[0].args,
                }))

                await session.send_tool_response(function_responses=function_responses)

async def session_handler(client_websocket: websockets.ServerProtocol) -> None:
    """
    Handles incoming WebSocket connections for the /video_stream path.
    """
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
    host = "0.0.0.0"
    port = 9080
    # websockets.serve will pass each new connection to session_handler
    async with websockets.serve(session_handler, host, port):
        logging.info(f"Asyncio WebSocket server started on ws://{host}:{port}")
        logging.info(f"This server will handle connections on any path (e.g., /video_stream).")
        logging.info("Press CTRL+C to stop the server.")
        await asyncio.Future()  # Run forever until CancelledError (e.g., by Ctrl+C)

if __name__ == "__main__":
    try:
        asyncio.run(main_server_loop())
    except KeyboardInterrupt:
        logging.info("Server shutting down...")
