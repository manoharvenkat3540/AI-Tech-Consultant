from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup


@dataclass
class Article:
    url: str
    title: str
    content: str
    images: list[dict] = field(default_factory=list)


async def fetch_article(
    client: httpx.AsyncClient,
    url: str,
) -> Article | None:
    """Download a support page and extract its content and images."""

    try:
        response = await client.get(url)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        print(f"Download failed: {type(exc).__name__}")
        return None

    soup = BeautifulSoup(response.text, "lxml")

    for element in soup.select(
        "script, style, nav, footer, header, noscript, iframe, form, svg, button"
    ):
        element.decompose()

    heading = soup.find("h1")

    if heading:
        title = heading.get_text(" ", strip=True)
    elif soup.title:
        title = soup.title.get_text(" ", strip=True)
    else:
        title = "Untitled Support Page"

    article_area = (
        soup.find("article")
        or soup.find(attrs={"itemprop": "articleBody"})
        or soup.find("main")
        or soup.body
        or soup
    )

    content = article_area.get_text(" ", strip=True)
    content = " ".join(content.split())

    images = []

    for image_tag in article_area.find_all("img"):
        image_url = (
            image_tag.get("src")
            or image_tag.get("data-src")
            or image_tag.get("data-original")
        )

        if image_url:
            images.append(
                {
                    "url": urljoin(url, image_url),
                    "alt": image_tag.get("alt", "").strip(),
                }
            )

    return Article(
        url=url,
        title=title,
        content=content,
        images=images,
    )


def extract_article_links(
    html: str,
    base_url: str,
) -> list[str]:
    """Find links to Brilliant Directories support pages."""

    soup = BeautifulSoup(html, "lxml")
    links = []

    for anchor in soup.find_all("a", href=True):
        absolute_url = urljoin(base_url, anchor["href"])
        parsed = urlparse(absolute_url)

        if parsed.netloc.lower() != "support.brilliantdirectories.com":
            continue

        path = parsed.path.rstrip("/")

        if not path.startswith("/support/solutions/"):
            continue

        remaining_path = path.removeprefix("/support/solutions/")

        # Exclude category URLs containing only a numeric ID.
        if remaining_path.isdigit():
            continue

        links.append(absolute_url)

    return list(dict.fromkeys(links))


if __name__ == "__main__":
    import asyncio

    async def main():
        test_url = (
            "https://support.brilliantdirectories.com/"
            "support/solutions/12000001519"
        )

        async with httpx.AsyncClient(
            timeout=30,
            follow_redirects=True,
            headers={
                "User-Agent": "AITechConsultantKnowledgeBot/1.0"
            },
        ) as client:
            article = await fetch_article(client, test_url)

        if article:
            print("Title:", article.title)
            print("URL:", article.url)
            print("Content length:", len(article.content))
            print("Images found:", len(article.images))
            print("Content preview:", article.content[:500])

    asyncio.run(main())