import os
from pathlib import Path

from dotenv import load_dotenv

# Locate task1-knowledge-brain/.env
PROJECT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_DIR / ".env")

# External knowledge source
SITEMAP_URL = os.getenv(
    "SITEMAP_URL",
    "https://support.brilliantdirectories.com/support/sitemap.xml",
)

# Claude configuration
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv(
    "ANTHROPIC_MODEL",
    "claude-sonnet-4-5",
)

# Local knowledge database
DATABASE_PATH = PROJECT_DIR / "knowledge.db"