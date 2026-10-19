import asyncio
import hashlib

import httpx

from app.crawler.sitemap import get_article_urls
from app.crawler.articles import fetch_article, extract_article_links
from app.database.store import (
    initialize_database,
    save_article,
    get_article_count,
    get_connection,
)


HEADERS = {
    "User-Agent": "AITechConsultantKnowledgeBot/1.0"
}


def get_existing_hash(url: str) -> str | None:
    """Return the stored content hash for an article, if available."""

    with get_connection() as connection:
        row = connection.execute(
            "SELECT content_hash FROM articles WHERE url = ?",
            (url,),
        ).fetchone()

    if row and row["content_hash"]:
        return row["content_hash"]

    return None


async def ingest_articles(limit: int | None = 10):
    print("Starting Knowledge Brain ingestion...")

    initialize_database()

    try:
        sitemap_urls = await get_article_urls()
    except Exception as exc:
        print(
            f"Could not retrieve sitemap: "
            f"{type(exc).__name__}: {exc}"
        )
        return

    print(f"Category and sitemap URLs discovered: {len(sitemap_urls)}")

    article_urls = []
    seen_urls = set()

    async with httpx.AsyncClient(
        timeout=30,
        follow_redirects=True,
        headers=HEADERS,
    ) as client:

        # Discover individual articles from sitemap pages.
        for index, url in enumerate(sitemap_urls, start=1):
            print(f"[Discovery {index}/{len(sitemap_urls)}] {url}")

            try:
                response = await client.get(url)
                response.raise_for_status()

                discovered = extract_article_links(
                    response.text,
                    url,
                )

                for article_url in discovered:
                    if "/support/solutions/articles/" not in article_url:
                        continue

                    if article_url not in seen_urls:
                        seen_urls.add(article_url)
                        article_urls.append(article_url)

            except httpx.HTTPError as exc:
                print(f"  Discovery failed: {type(exc).__name__}")

            await asyncio.sleep(0.5)

        print(f"\nIndividual articles discovered: {len(article_urls)}")
        if not article_urls:
            print("No articles discovered. Keeping the existing database unchanged.")
            return
        if limit is not None and limit > 0:
            article_urls = article_urls[:limit]

        inserted = 0
        updated = 0
        unchanged = 0
        skipped = 0
        failed = 0

        # Download and compare each individual article.
        for index, url in enumerate(article_urls, start=1):
            print(f"\n[Article {index}/{len(article_urls)}] {url}")

            try:
                article = await fetch_article(client, url)

                if article is None:
                    failed += 1
                    continue

                title = (article.title or "").strip()
                content = (article.content or "").strip()

                if len(content) < 200:
                    print("  Skipped: insufficient article content")
                    skipped += 1
                    continue

                content_hash = hashlib.sha256(
                    f"{title}\n{content}".encode("utf-8")
                ).hexdigest()

                old_hash = get_existing_hash(article.url)

                if old_hash == content_hash:
                    print(f"  Unchanged: {title}")
                    unchanged += 1
                    continue

                # Determine whether this is a new or existing article.
                with get_connection() as connection:
                    exists = connection.execute(
                        "SELECT 1 FROM articles WHERE url = ?",
                        (article.url,),
                    ).fetchone() is not None

                # Save new or changed content.
                save_article(article)

                with get_connection() as connection:
                    connection.execute(
                        """
                        UPDATE articles
                        SET content_hash = ?
                        WHERE url = ?
                        """,
                        (content_hash, article.url),
                    )

                if exists:
                    updated += 1
                    print(f"  Updated: {title}")
                else:
                    inserted += 1
                    print(f"  Inserted: {title}")

            except Exception as exc:
                failed += 1
                print(f"  Failed: {type(exc).__name__}: {exc}")

            await asyncio.sleep(1)

    print("\n========== INGESTION SUMMARY ==========")
    print(f"New articles inserted: {inserted}")
    print(f"Existing articles updated: {updated}")
    print(f"Unchanged articles skipped: {unchanged}")
    print(f"Articles skipped for insufficient content: {skipped}")
    print(f"Failed downloads: {failed}")
    print(f"Total articles in database: {get_article_count()}")
    print("=======================================")


if __name__ == "__main__":
    asyncio.run(ingest_articles(limit=None))