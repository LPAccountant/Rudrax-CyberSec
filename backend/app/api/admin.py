from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import aiosqlite
from app.core.database import get_db
from app.core.deps import require_admin
from app.core.security import hash_password

router = APIRouter(prefix="/api/admin", tags=["admin"])

class UpdateUserRequest(BaseModel):
    role: str | None = None
    is_active: bool | None = None
    is_approved: bool | None = None

class CreateUserRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str = "developer"

class UpdateSettingRequest(BaseModel):
    key: str
    value: str

@router.get("/users")
async def list_users(admin: dict = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT id, email, name, role, is_active, is_approved, created_at FROM users ORDER BY created_at DESC")
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]

@router.put("/users/{user_id}")
async def update_user(user_id: int, req: UpdateUserRequest, admin: dict = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    updates = []
    params = []
    if req.role is not None:
        updates.append("role = ?")
        params.append(req.role)
    if req.is_active is not None:
        updates.append("is_active = ?")
        params.append(int(req.is_active))
    if req.is_approved is not None:
        updates.append("is_approved = ?")
        params.append(int(req.is_approved))
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    params.append(user_id)
    await db.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", params)
    await db.commit()
    return {"message": "User updated"}

@router.delete("/users/{user_id}")
async def delete_user(user_id: int, admin: dict = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT role FROM users WHERE id = ?", (user_id,))
    user = await cursor.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if dict(user)["role"] == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin user")
    await db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    await db.commit()
    return {"message": "User deleted"}

@router.post("/users")
async def create_user(req: CreateUserRequest, admin: dict = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT id FROM users WHERE email = ?", (req.email,))
    if await cursor.fetchone():
        raise HTTPException(status_code=400, detail="Email already exists")
    pw_hash = hash_password(req.password)
    await db.execute(
        "INSERT INTO users (email, password_hash, name, role, is_approved) VALUES (?, ?, ?, ?, 1)",
        (req.email, pw_hash, req.name, req.role)
    )
    await db.commit()
    return {"message": "User created"}

@router.get("/settings")
async def get_settings(admin: dict = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT key, value FROM settings")
    rows = await cursor.fetchall()
    return {r["key"]: r["value"] for r in rows}

@router.put("/settings")
async def update_setting(req: UpdateSettingRequest, admin: dict = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    await db.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
        (req.key, req.value, req.value)
    )
    await db.commit()
    return {"message": "Setting updated"}
