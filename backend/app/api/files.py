from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import aiofiles
from app.core.deps import get_current_user
from app.core.config import WORKSPACE_DIR

router = APIRouter(prefix="/api/files", tags=["files"])

class CreateFileRequest(BaseModel):
    path: str
    content: str

class RenameFileRequest(BaseModel):
    old_path: str
    new_path: str

def safe_path(base: str, path: str) -> str:
    full = os.path.normpath(os.path.join(base, path))
    if not full.startswith(os.path.normpath(base)):
        raise HTTPException(status_code=400, detail="Invalid path")
    return full

@router.get("/list")
async def list_files(path: str = "", current_user: dict = Depends(get_current_user)):
    user_dir = os.path.join(WORKSPACE_DIR, str(current_user["id"]))
    os.makedirs(user_dir, exist_ok=True)
    target = safe_path(user_dir, path)
    if not os.path.exists(target):
        return []
    items = []
    for name in sorted(os.listdir(target)):
        full_path = os.path.join(target, name)
        rel_path = os.path.relpath(full_path, user_dir)
        items.append({
            "name": name,
            "path": rel_path,
            "is_dir": os.path.isdir(full_path),
            "size": os.path.getsize(full_path) if os.path.isfile(full_path) else 0,
        })
    return items

@router.get("/read")
async def read_file(path: str, current_user: dict = Depends(get_current_user)):
    user_dir = os.path.join(WORKSPACE_DIR, str(current_user["id"]))
    full_path = safe_path(user_dir, path)
    if not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    async with aiofiles.open(full_path, "r") as f:
        content = await f.read()
    return {"path": path, "content": content}

@router.post("/write")
async def write_file(req: CreateFileRequest, current_user: dict = Depends(get_current_user)):
    user_dir = os.path.join(WORKSPACE_DIR, str(current_user["id"]))
    full_path = safe_path(user_dir, req.path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    async with aiofiles.open(full_path, "w") as f:
        await f.write(req.content)
    return {"message": "File saved", "path": req.path}

@router.delete("/delete")
async def delete_file(path: str, current_user: dict = Depends(get_current_user)):
    user_dir = os.path.join(WORKSPACE_DIR, str(current_user["id"]))
    full_path = safe_path(user_dir, path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    if os.path.isdir(full_path):
        import shutil
        shutil.rmtree(full_path)
    else:
        os.remove(full_path)
    return {"message": "Deleted"}

@router.get("/download")
async def download_file(path: str, current_user: dict = Depends(get_current_user)):
    user_dir = os.path.join(WORKSPACE_DIR, str(current_user["id"]))
    full_path = safe_path(user_dir, path)
    if not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(full_path, filename=os.path.basename(full_path))

@router.post("/mkdir")
async def make_directory(path: str, current_user: dict = Depends(get_current_user)):
    user_dir = os.path.join(WORKSPACE_DIR, str(current_user["id"]))
    full_path = safe_path(user_dir, path)
    os.makedirs(full_path, exist_ok=True)
    return {"message": "Directory created"}

@router.post("/upload")
async def upload_file(path: str = "", file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    user_dir = os.path.join(WORKSPACE_DIR, str(current_user["id"]))
    target_dir = safe_path(user_dir, path)
    os.makedirs(target_dir, exist_ok=True)
    file_path = os.path.join(target_dir, file.filename)
    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)
    return {"message": "File uploaded", "path": os.path.relpath(file_path, user_dir)}
