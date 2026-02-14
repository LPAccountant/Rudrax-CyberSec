import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "rudrax-super-secret-key-change-in-production-2024")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./rudrax.db")
WORKSPACE_DIR = os.getenv("WORKSPACE_DIR", "/tmp/rudrax_workspace")
_default_db = "/data/rudrax.db" if os.path.isdir("/data") else "./rudrax.db"
DB_PATH = os.getenv("DB_PATH", _default_db)
