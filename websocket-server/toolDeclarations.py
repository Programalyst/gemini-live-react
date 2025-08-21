# Define the function declarations for LiveAPI

clickScreenPosition = {
  "name": "click_screen_position",
  "description": "Clicks the provided screen position in pixels. 0x, 0y is the top left of the screen.",
  "parameters": {
    "type": "object",
    "properties": {
      "screenX": {
        "type": "number",
        "description": "A float value number of pixels from the left to click. 0 would be left edge of the screen.",
      },
      "screenY": {
        "type": "number",
        "description": "A float value number of pixels from the top to click. 0 would be top edge of the screen.",
      },
    },
    "required": ["screenX", "screenY"]
  }
}

