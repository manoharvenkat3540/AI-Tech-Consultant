import os
import asyncio
import xml.etree.ElementTree as ET
from pathlib import Path

import httpx
from dotenv import load_dotenv

PROJECT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_DIR / ".env", override=True)

SITEMAP_URL = os.getenv(
    "SITEMAP_URL",
    "https://support.brilliantdirectories.com/support/sitemap.xml",
)


async def get_article_urls(sitemap_url: str = SITEMAP_URL) -> list[str]:
    """Fetch support solution URLs from the XML sitemap."""

    print(f"Reading sitemap: {sitemap_url}")

    async with httpx.AsyncClient(
        timeout=30,
        follow_redirects=True,
        headers={"User-Agent": "AITechConsultantKnowledgeBot/1.0"},
    ) as client:
        response = await client.get(sitemap_url)
        response.raise_for_status()

    root = ET.fromstring(response.content)
    urls = []

    for element in root.iter():
        if element.tag.endswith("loc") and element.text:
            url = element.text.strip()

            if (
                url.startswith("https://support.brilliantdirectories.com/")
                and "/support/solutions/" in url
                and url.rstrip("/").split("/")[-1].isdigit()
            ):
                urls.append(url)

    # Remove duplicates while preserving their order.
    urls = list(dict.fromkeys(urls))

    print(f"Found {len(urls)} support solution URLs.")

    return urls


if __name__ == "__main__":
    results = asyncio.run(get_article_urls())

    print("\nFirst 10 URLs:")
    for url in results[:10]:
        print(url)