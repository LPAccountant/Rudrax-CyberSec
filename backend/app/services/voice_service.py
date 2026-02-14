import base64
import io
import json
import re
from app.services.ollama_service import query_ollama


HINDI_SYSTEM_PROMPT = """You are RudraX AI, a cybersecurity assistant. 
You can respond in Hindi, English, or Hinglish (mix of Hindi and English) based on the user's language.
If the user writes in Hindi or Hinglish, respond in the same language.
You are an expert in cybersecurity, networking, ethical hacking, and IT security training."""

HINGLISH_PATTERNS = [
    r'\b(kya|kaise|karo|hai|hain|mein|yeh|woh|kuch|nahi|bhi|aur|se|ko|ka|ki|ke)\b',
    r'\b(bhai|yaar|accha|theek|chalo|dekho|batao|samjho)\b',
]


def detect_language(text: str) -> str:
    hindi_chars = len(re.findall(r'[\u0900-\u097F]', text))
    total_chars = len(text.strip())
    if total_chars == 0:
        return "en"
    if hindi_chars / total_chars > 0.3:
        return "hi"
    hinglish_matches = sum(
        len(re.findall(pattern, text.lower())) for pattern in HINGLISH_PATTERNS
    )
    if hinglish_matches >= 2:
        return "hinglish"
    return "en"


def get_system_prompt_for_language(lang: str, context: str = "cybersecurity") -> str:
    if lang == "hi":
        return f"""{HINDI_SYSTEM_PROMPT}
Always respond in Hindi (Devanagari script). 
Context: {context}"""
    elif lang == "hinglish":
        return f"""{HINDI_SYSTEM_PROMPT}
Respond in Hinglish (mix of Hindi and English using Roman script).
Context: {context}"""
    return f"""You are RudraX AI, a cybersecurity assistant expert in {context}.
Respond in clear English."""


async def process_voice_text(
    text: str,
    model: str = "llama3",
    context: str = "cybersecurity",
    force_language: str | None = None,
) -> dict:
    lang = force_language or detect_language(text)
    system_prompt = get_system_prompt_for_language(lang, context)
    response = await query_ollama(text, model=model, system=system_prompt)
    return {
        "input_text": text,
        "detected_language": lang,
        "response": response,
        "model": model,
    }


async def translate_text(text: str, target_lang: str, model: str = "llama3") -> str:
    lang_names = {"hi": "Hindi", "en": "English", "hinglish": "Hinglish"}
    target = lang_names.get(target_lang, "English")
    prompt = f"Translate the following text to {target}. Only output the translation, nothing else:\n\n{text}"
    return await query_ollama(prompt, model=model)
