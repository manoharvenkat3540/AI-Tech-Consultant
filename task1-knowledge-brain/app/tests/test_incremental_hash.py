import hashlib


def calculate_hash(title: str, content: str) -> str:
    text = f"{title}\n{content}"
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def test_unchanged_article_has_same_hash():
    first = calculate_hash(
        "Domain Setup",
        "Instructions for connecting a domain.",
    )

    second = calculate_hash(
        "Domain Setup",
        "Instructions for connecting a domain.",
    )

    assert first == second


def test_changed_article_has_different_hash():
    first = calculate_hash(
        "Domain Setup",
        "Instructions for connecting a domain.",
    )

    second = calculate_hash(
        "Domain Setup",
        "Updated instructions for connecting a domain.",
    )

    assert first != second