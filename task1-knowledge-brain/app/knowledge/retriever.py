import json
import re
import sqlite3
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[2]
DATABASE_PATH = PROJECT_DIR / "knowledge.db"


STOP_WORDS = {
    "the", "is", "a", "an", "and", "or", "to", "for",
    "in", "on", "of", "how", "do", "i", "can", "my",
    "what", "where", "with", "me", "please", "does",
    "this", "that", "it", "your", "you", "be", "are",
    "from", "at", "by", "as", "have", "has", "will",
    "would", "could", "should", "about", "get", "use",
}


def tokenize(text: str) -> list[str]:
    """Convert text into useful searchable words."""

    words = re.findall(r"[a-zA-Z0-9]+", text.lower())

    return [
        word
        for word in words
        if word not in STOP_WORDS and len(word) > 1
    ]


def search_articles(
    question: str,
    limit: int = 5,
) -> list[dict]:
    """Return articles ranked by relevance to the user's question."""

    if not question or not question.strip():
        return []

    if not DATABASE_PATH.exists():
        print(f"Database not found: {DATABASE_PATH}")
        return []

    keywords = list(dict.fromkeys(tokenize(question)))

    if not keywords:
        return []

    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row

    try:
        # Retrieve candidate articles containing at least one keyword.
        conditions = []
        parameters = []

        for word in keywords:
            conditions.append(
                "(LOWER(title) LIKE ? OR LOWER(content) LIKE ?)"
            )

            pattern = f"%{word}%"
            parameters.extend([pattern, pattern])

        query = f"""
            SELECT url, title, content, images_json
            FROM articles
            WHERE {" OR ".join(conditions)}
        """

        rows = connection.execute(query, parameters).fetchall()

        candidates = []

        for row in rows:
            title = row["title"] or ""
            content = row["content"] or ""

            title_words = set(tokenize(title))
            content_words = set(tokenize(content))

            # Give title matches more importance than content matches.
            title_matches = sum(
                1 for word in keywords if word in title_words
            )

            content_matches = sum(
                1 for word in keywords if word in content_words
            )

            # Reward articles matching multiple question keywords.
            score = (title_matches * 5) + content_matches

            # Penalize generic category pages.
            url = row["url"] or ""

            if "/support/solutions/folders/" in url:
                score -= 10

            if (
                "/support/solutions/articles/" not in url
                and "/support/solutions/folders/" not in url
            ):
                score -= 5

            if score <= 3:
                continue

            try:
                images = json.loads(row["images_json"] or "[]")
            except (json.JSONDecodeError, TypeError):
                images = []

            candidates.append(
                {
                    "url": url,
                    "title": title,
                    "content": content,
                    "images": images,
                    "score": score,
                }
            )

        # Highest-scoring articles appear first.
        candidates.sort(
            key=lambda article: (
                article["score"],
                len(article["content"]),
            ),
            reverse=True,
        )

        return candidates[:max(1, limit)]

    finally:
        connection.close()


if __name__ == "__main__":
    question = input("Enter a support question: ")

    articles = search_articles(question)

    print(f"\nArticles found: {len(articles)}")

    for article in articles:
        print(f"\nRelevance score: {article['score']}")
        print(f"Title: {article['title']}")
        print(f"URL: {article['url']}")
        print(f"Content preview: {article['content'][:300]}")