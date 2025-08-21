# backend setup 

### 1. Install Python 3.11.7+
   (taskgroup, exceptiongroup are built-in in `3.11.7+` so will not require a separate install and import)

### 2. switch to the backend folder
```
cd websocket-server
```

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
pip install - r requirements.txt
```

OR Manually installing packages:
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

### 8a. Run Voice in and voice out version
```bash
python voiceInOut.py
```

### 8b. Run Voice in and text out version
```bash
python voiceInTextOut.py
```