# backend setup 

### 1. Install Python 3.11.7+
Intall Python `3.11.7+` if you don't already have it installed. 
`taskgroup`, `exceptiongroup` are built-in in `3.11.7+` so will not require a separate install and import

### 2. Switch to the backend folder
```
cd websocket-server
```
Note: You may want to open this folder (not the root folder) in VSCode so it recognizes the Python virtual environment as the interpreter to use.

### 3. Create a Python virtual environment
```bash
python -m venv .venv
```

### 4. Activate the virtual environment if it's already created
```bash
source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
```

### 5. Install dependancies
```bash
pip install -r requirements.txt
```

OR manually install packages:
```bash
pip install python-dotenv websockets google-genai
```
Note: `google-generativeai` is the old deprecated SDK; use `google-genai` 

### 6. Create a `.env` file:
```bash
touch .env
```

### 7. Add your Gemini API key in the `.env` file
```bash
GEMINI_API_KEY=<YOUR API KEY>
```

### 8. Run the server

Option a: Run Voice-in/out and voice out version 
```bash
python voiceInOut.py
```

Option b: Run Voice-in-text-out version
```bash
python voiceInTextOut.py
```

Notes: in the Gemini config object, despite `response_modalities` being a list, only one response modality can be specified at a time: either "TEXT" or "AUDIO"