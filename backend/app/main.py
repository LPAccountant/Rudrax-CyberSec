from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import init_db
from app.core.security import hash_password
from app.core.config import DB_PATH
from app.api import auth, admin, chat, models, tasks, files, pentest, agent
import aiosqlite


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_admin()
    yield


async def seed_admin():
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT id FROM users WHERE email = ?", ("lalittheonly@gmail.com",))
        existing = await cursor.fetchone()
        if not existing:
            pw_hash = hash_password("RudraX3#123nda")
            await db.execute(
                "INSERT INTO users (email, password_hash, name, role, is_active, is_approved) VALUES (?, ?, ?, 'admin', 1, 1)",
                ("lalittheonly@gmail.com", pw_hash, "Admin")
            )
            await db.commit()


app = FastAPI(title="RudraX CyberSec Platform", version="1.0.0", lifespan=lifespan)

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(chat.router)
app.include_router(models.router)
app.include_router(tasks.router)
app.include_router(files.router)
app.include_router(pentest.router)
app.include_router(agent.router)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
