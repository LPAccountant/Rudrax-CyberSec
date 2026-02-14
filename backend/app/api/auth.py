from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
import aiosqlite
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str
    is_active: bool
    is_approved: bool

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM users WHERE email = ?", (req.email,))
    user = await cursor.fetchone()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    user = dict(user)
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user["is_active"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    if not user["is_approved"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account pending admin approval")
    token = create_access_token({"sub": str(user["id"]), "role": user["role"]})
    return TokenResponse(
        access_token=token,
        user={
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "is_active": bool(user["is_active"]),
            "is_approved": bool(user["is_approved"]),
        }
    )

@router.post("/register")
async def register(req: RegisterRequest, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT id FROM users WHERE email = ?", (req.email,))
    existing = await cursor.fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    pw_hash = hash_password(req.password)
    await db.execute(
        "INSERT INTO users (email, password_hash, name, role, is_approved) VALUES (?, ?, ?, 'developer', 0)",
        (req.email, pw_hash, req.name)
    )
    await db.commit()
    return {"message": "Registration successful. Awaiting admin approval."}

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "role": current_user["role"],
        "is_active": bool(current_user["is_active"]),
        "is_approved": bool(current_user["is_approved"]),
    }
