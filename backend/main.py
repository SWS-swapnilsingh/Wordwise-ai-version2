import os
import io
import re
import urllib.parse
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from format_template import format_str

# Resolve paths
BACKEND_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BACKEND_DIR.parent / "frontend"

import sys
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Load environment variables from .env file (supports running from root or backend directory)
load_dotenv(BACKEND_DIR / ".env")
load_dotenv()

app = FastAPI(title="WordWise AI")

# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount frontend directory as static files
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


# ---------- Request model ----------
class WordRequest(BaseModel):
    word: str


# ---------- Gemini API Client / Fallback Runner ----------
def generate_gemini_content(prompt: str) -> str:
    """
    Generate content using Gemini model (gemini-2.5-flash).
    Tries:
      1. google-genai SDK (newest client)
      2. google-generativeai SDK (legacy client)
      3. Direct HTTP call to Google's REST API (fallback without extra packages)
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("Please set the GEMINI_API_KEY environment variable.")

    # 1. Try google-genai SDK
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        if hasattr(response, "text") and response.text:
            return response.text
    except ImportError:
        pass
    except Exception as e:
        # If it was an API error or key error, raise it
        if "API_KEY_INVALID" in str(e) or "400" in str(e) or "403" in str(e):
            raise e

    # 2. Try google-generativeai SDK
    try:
        import google.generativeai as legacy_genai
        legacy_genai.configure(api_key=api_key)
        model = legacy_genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        if hasattr(response, "text") and response.text:
            return response.text
    except ImportError:
        pass
    except Exception as e:
        if "API_KEY_INVALID" in str(e) or "400" in str(e) or "403" in str(e):
            raise e

    # 3. Direct REST API call (fallback requiring only httpx or requests)
    try:
        import httpx
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }]
        }
        resp = httpx.post(url, json=payload, timeout=45.0)
        data = resp.json()
        if resp.status_code != 200:
            error_msg = data.get("error", {}).get("message", resp.text)
            raise RuntimeError(f"Gemini API Error ({resp.status_code}): {error_msg}")
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except ImportError:
        import requests
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }]
        }
        resp = requests.post(url, json=payload, timeout=45.0)
        data = resp.json()
        if resp.status_code != 200:
            error_msg = data.get("error", {}).get("message", resp.text)
            raise RuntimeError(f"Gemini API Error ({resp.status_code}): {error_msg}")
        return data["candidates"][0]["content"]["parts"][0]["text"]


# ---------- TTS Audio Generator ----------
def generate_tts_audio(word: str) -> io.BytesIO:
    """
    Generate US English pronunciation MP3 audio.
    Tries:
      1. gTTS library (tld='com' for US accent)
      2. Direct Google Translate TTS endpoint via HTTP fallback
    """
    # 1. Try gTTS
    try:
        from gtts import gTTS
        tts = gTTS(text=word, lang="en", tld="com")
        mp3_fp = io.BytesIO()
        tts.write_to_fp(mp3_fp)
        mp3_fp.seek(0)
        return mp3_fp
    except ImportError:
        pass

    # 2. HTTP fallback to Google Translate TTS
    import httpx
    encoded_word = urllib.parse.quote(word)
    url = f"https://translate.google.com/translate_tts?ie=UTF-8&tl=en-US&client=tw-ob&q={encoded_word}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    resp = httpx.get(url, headers=headers, timeout=15.0)
    if resp.status_code == 200:
        return io.BytesIO(resp.content)
    raise RuntimeError(f"TTS generation failed with status {resp.status_code}")


# ---------- Endpoints ----------

@app.get("/")
async def serve_index():
    """Serve the frontend index.html."""
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return JSONResponse({"error": "index.html not found"}, status_code=404)


@app.post("/api/meaning")
async def get_enhanced_meaning(req: WordRequest):
    """
    Queries Gemini API for comprehensive word meaning, matching simple_app.py prompt.
    """
    word = req.word.strip()
    if not word:
        return JSONResponse({"error": "Please enter a word."}, status_code=400)

    prompt = f""" 

            1. Give the most common usage and meaning of the word in English. Use simple English. Do not use any technical terms. Do not use any complex words.

            2. Give the Etymology of the word. Where does it come from?

            3. Simple pronunciation in US English. Tell which part to stress and a similar pronunciation word.

            4. Tell the part of speech. For example: noun, verb, adjective, etc.

            5. First, Second, and Third forms of that word. This applies to verbs. Example: go – went – gone.

            6. How can other forms of speech be created from it? Show how the word can become a noun, verb, adjective, adverb, etc., and give those forms.

            7. Some number of example sentences. Use simple, useful sentences that help in understanding the word in context.

            8. Common phrases of this word and their meaning. Meaning of each phrase. A usage rating out of 5 (5 = very common, 1 = rare). Give one example sentence. Mention industries or topics where that phrase is mostly used (e.g., business, education, casual speech, technology, etc.)

            9. Present the result in a structured format={format_str}.

            10. Add Synonyms and Antonyms under heading "Other Details".

            word: {word}
            """

    try:
        result_text = generate_gemini_content(prompt)
        return {"result": result_text}
    except Exception as e:
        return JSONResponse({"error": f"Error fetching information: {e}"}, status_code=500)


@app.post("/api/pronunciation")
async def get_pronunciation(req: WordRequest):
    """
    Fetches the pronunciation of a word matching simple_app.py prompt.
    """
    word = req.word.strip()
    if not word:
        return JSONResponse({"error": "Please enter a word."}, status_code=400)

    prompt = f"""Simple pronunciation in US English for word={word}. Tell which part to stress and a similar pronunciation word."""

    try:
        result_text = generate_gemini_content(prompt)
        return {"result": result_text}
    except Exception as e:
        return JSONResponse({"error": f"Error fetching information: {e}"}, status_code=500)


@app.post("/api/tts")
async def text_to_speech(req: WordRequest):
    """
    Generates US English pronunciation audio using gTTS (or fallback).
    """
    word = req.word.strip()
    if not word:
        return JSONResponse({"error": "Please enter a word."}, status_code=400)

    try:
        audio_stream = generate_tts_audio(word)
        return StreamingResponse(audio_stream, media_type="audio/mpeg")
    except Exception as e:
        return JSONResponse({"error": f"Error generating audio: {e}"}, status_code=500)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, app_dir=str(BACKEND_DIR))
