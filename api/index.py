import sys
from pathlib import Path

# Ensure root directory is on Python path for Vercel Serverless Function
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.server import app
