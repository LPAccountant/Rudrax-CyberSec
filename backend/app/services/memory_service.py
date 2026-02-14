import json
from datetime import datetime
import aiosqlite
from app.core.config import DB_PATH


async def store_memory(user_id: int, context_key: str, content: str) -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO memory_store (user_id, context_key, content) VALUES (?, ?, ?)",
            (user_id, context_key, content),
        )
        await db.commit()
    return {"status": "stored", "context_key": context_key}


async def retrieve_memory(user_id: int, context_key: str, limit: int = 10) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM memory_store WHERE user_id = ? AND context_key = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, context_key, limit),
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def search_memory(user_id: int, query: str, limit: int = 10) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM memory_store WHERE user_id = ? AND content LIKE ? ORDER BY created_at DESC LIMIT ?",
            (user_id, f"%{query}%", limit),
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def clear_memory(user_id: int, context_key: str | None = None) -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        if context_key:
            await db.execute(
                "DELETE FROM memory_store WHERE user_id = ? AND context_key = ?",
                (user_id, context_key),
            )
        else:
            await db.execute("DELETE FROM memory_store WHERE user_id = ?", (user_id,))
        await db.commit()
    return {"status": "cleared"}
