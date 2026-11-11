# WordWise AI — HTML/CSS/JS + FastAPI

A modern web application rebuild of **WordWise AI** — an English word learning tool powered by the **Google Gemini API** (`gemini-2.5-flash`), **Google Text-to-Speech (gTTS)**, and native video pronunciation context powered by **YouGlish**.

---

## 🚀 Features

- **Comprehensive Word Lookup (Center Column):** Simple definitions, etymology, part of speech, verb forms (V1, V2, V3), derivations, example sentences, common phrases with usage ratings (⭐), past/present/future examples, and synonyms/antonyms.
- **US English Pronunciation (Left Column):** Detailed phonetic guide with stress patterns, similar-sounding words, and instant in-browser audio playback via gTTS.
- **Native Context Video Embed (Right Column - YouGlish):** 
  - **YouTube Video Area:** Real-world video clips from TED Talks, conferences, and interviews showing natural pronunciation in context.
  - **Transcript Area:** Synchronized captions with the target word highlighted in yellow. Click on any word in the transcript to jump to that moment in the video.
  - **Pronunciation Area:** Built-in speech coach integration (`Fluently: AI English Coach`) with interactive practice ("Tap and Read the Text").
  - **Accent Filtering:** Switch instantly between US, UK, Australian, and All English accents.
  - **Auto-Sync:** Searching a word in the Meaning or Pronunciation sections automatically updates the YouGlish video and transcript!
- **Responsive 3-Column Design:** Desktop three-column layout that gracefully adjusts for laptops and tablets, and collapses into a clean mobile layout.
- **Persistent Footer:** Styled fixed footer with review form link matching the original design.

---

## 📁 Project Structure

```
WordwiseAI-html-css-js/
├── backend/
│   ├── main.py              # FastAPI server with all API routes & REST fallback
│   ├── format_template.py   # Structured markdown response template
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Template for environment variables
└── frontend/
    ├── index.html           # 3-column UI (Pronunciation, Meaning, YouGlish)
    ├── styles.css           # Modern styles + responsive breakpoints
    └── app.js               # Frontend logic, API calls, YouGlish widget integration
```

---

## 🛠️ Tech Stack

- **Backend:** Python 3.10+, [FastAPI](https://fastapi.tiangolo.com/), [Uvicorn](https://www.uvicorn.org/), [`google-genai`](https://github.com/google-gemini/generative-ai-python), [gTTS](https://gtts.readthedocs.io/), [httpx](https://www.python-httpx.org/)
- **Frontend:** Vanilla HTML5, CSS3 (CSS Grid/Flexbox), JavaScript (ES6+), [marked.js](https://marked.js.org/), [Font Awesome 6](https://fontawesome.com/), [YouGlish Widget API](https://youglish.com/)

---

## ⚙️ Setup & Installation

### 1. Prerequisites
- Python 3.10 or higher
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### 2. Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Configure API Key

Create a `.env` file in the `backend/` directory:

```bash
# In backend/.env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

Or set the environment variable directly:

- **Windows (PowerShell):**
  ```powershell
  $env:GEMINI_API_KEY="your_actual_gemini_api_key_here"
  ```
- **macOS / Linux:**
  ```bash
  export GEMINI_API_KEY="your_actual_gemini_api_key_here"
  ```

### 4. Run the application

If using the existing virtual environment:
```powershell
# Activate venv (PowerShell)
.\venv\Scripts\Activate.ps1

# Start the server
python backend/main.py
```

Or run directly with the venv Python:
```powershell
.\venv\Scripts\python.exe backend/main.py
```

Or with `uvicorn`:
```bash
uvicorn backend.main:app --reload --port 8000
```

Open **http://localhost:8000** in your browser.

---

## 🔌 API Reference

| Endpoint | Method | Payload | Description |
|---|---|---|---|
| `/` | `GET` | — | Serves the frontend application |
| `/api/meaning` | `POST` | `{"word": "string"}` | Returns structured markdown with complete word breakdown |
| `/api/pronunciation` | `POST` | `{"word": "string"}` | Returns US English pronunciation guide text |
| `/api/tts` | `POST` | `{"word": "string"}` | Streams US English MP3 audio generated via gTTS |
