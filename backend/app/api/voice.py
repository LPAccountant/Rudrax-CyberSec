from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.deps import get_current_user
from app.services.voice_service import process_voice_text, detect_language, translate_text

router = APIRouter(prefix="/api/voice", tags=["voice"])


class VoiceRequest(BaseModel):
    text: str
    model: str = "llama3"
    context: str = "cybersecurity"
    language: str | None = None


class TranslateRequest(BaseModel):
    text: str
    target_language: str = "en"
    model: str = "llama3"


@router.post("/process")
async def voice_process(req: VoiceRequest, current_user: dict = Depends(get_current_user)):
    result = await process_voice_text(
        text=req.text, model=req.model,
        context=req.context, force_language=req.language,
    )
    return result


@router.post("/detect-language")
async def voice_detect_language(req: VoiceRequest, current_user: dict = Depends(get_current_user)):
    lang = detect_language(req.text)
    return {"text": req.text, "detected_language": lang}


@router.post("/translate")
async def voice_translate(req: TranslateRequest, current_user: dict = Depends(get_current_user)):
    translated = await translate_text(req.text, req.target_language, req.model)
    return {"original": req.text, "translated": translated, "target_language": req.target_language}
