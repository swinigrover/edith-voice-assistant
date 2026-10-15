import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

# Load environment variables from .env if present
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH, override=True)
else:
    load_dotenv()

class Config:
    PORT: int = int(os.environ.get("PORT", "8000"))
    HOST: str = os.environ.get("HOST", "0.0.0.0")
    GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "") or os.environ.get("GOOGLE_API_KEY", "")
    IS_VERCEL: bool = bool(os.environ.get("VERCEL"))
    MEMORY_FILE: Path = Path("/tmp/memory.json") if IS_VERCEL else (BASE_DIR / "backend" / "data" / "memory.json")

    @classmethod
    def update_api_key(cls, key: str):
        cls.GEMINI_API_KEY = key.strip()
        os.environ["GEMINI_API_KEY"] = cls.GEMINI_API_KEY
        if cls.IS_VERCEL:
            return  # Read-only filesystem on Vercel
        # Persist to .env file
        try:
            lines = []
            if ENV_PATH.exists():
                lines = ENV_PATH.read_text(encoding="utf-8").splitlines()
            key_updated = False
            new_lines = []
            for line in lines:
                if line.startswith("GEMINI_API_KEY="):
                    new_lines.append(f"GEMINI_API_KEY={cls.GEMINI_API_KEY}")
                    key_updated = True
                else:
                    new_lines.append(line)
            if not key_updated:
                new_lines.append(f"GEMINI_API_KEY={cls.GEMINI_API_KEY}")
            ENV_PATH.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
        except Exception as e:
            print(f"Warning: could not write to .env: {e}")

config = Config()
