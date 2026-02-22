"""
Voice personal account service.
Uses hard-coded 10-second scripts and ElevenLabs for TTS.
No Gemini — scripts are pre-written and personalized per hurricane.
"""
import os
import base64

try:
    from dotenv import load_dotenv
    from pathlib import Path
    _env_path = Path(__file__).parent / ".env"
    load_dotenv(_env_path)
except ImportError:
    pass

ELEVENLABS_KEY = os.getenv("ELEVENLABS_API_KEY")

VOICE_IDS = [
    "21m00Tcm4TlvDq8ikWAM",   # Rachel
    "pNInz6obpgDQGcFmaJgB",   # Adam
    "EXAVITQu4vr4xnSDxMaL",   # Bella
    "ErXwobaYiN019PkySvjV",   # Antoni
    "MF3mGyEYCl7XYWbV9V6O",   # Elli
    "TxGEqnHWrfWFTfGW9XjX",   # Josh
    "yoZ06aMxZJJ28mfd3POQ",   # Sam
    "Zlb1dXrM653N07WRdFW3",   # Joseph
    "XB0fDUnXU5powFXDhCwa",   # Charlotte
    "LcfcDJNUP1GQjkzn1xUU",   # Emily
    "VR6AewLTigWG4xSOukaG",   # Arnold
    "AZnzlk1XvdvUeBnXmlld",   # Domi
    "onwK4e9ZLuTAKqWW03F9",   # Daniel
    "Xb7hH8MSUJpSbSDYk0k2",   # Alice
]


def _text_to_speech(text: str, voice_id: str) -> bytes | None:
    """Convert text to speech via ElevenLabs."""
    if not ELEVENLABS_KEY:
        return None
    try:
        import requests
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_KEY,
        }
        payload = {
            "text": text[:5000],
            "model_id": "eleven_multilingual_v2",
        }
        resp = requests.post(url, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
        return resp.content
    except Exception:
        return None


def generate_voice_account(hurricane_id: str) -> dict:
    """
    Generate audio for the hard-coded script for this hurricane.
    Returns: {"script": str, "audio_base64": str | None, "error": str | None}
    """
    from voice_scripts import SCRIPTS, get_voice_index

    script = SCRIPTS.get(
        hurricane_id,
        "I lived through the storm. We lost everything. Please support hurricane relief."
    )
    voice_idx = get_voice_index(hurricane_id)
    voice_id = VOICE_IDS[voice_idx]
    audio = _text_to_speech(script, voice_id)
    return {
        "script": script,
        "audio_base64": base64.b64encode(audio).decode() if audio else None,
        "error": None if audio else "ElevenLabs API key missing or TTS failed",
    }
