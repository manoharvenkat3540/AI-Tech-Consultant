import os
from pathlib import Path

from dotenv import load_dotenv
from groq import Groq

from app.knowledge.retriever import search_articles


# Load environment variables from the Task 1 folder.
PROJECT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_DIR / ".env", override=True)


# Initialize Groq only when an API key is available.
api_key = os.getenv("GROQ_API_KEY")
client = Groq(api_key=api_key) if api_key else None

MODEL_NAME = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")


def answer_question(question: str) -> dict:
    """
    Search the local knowledge database and use Groq
    to generate a grounded support answer.
    """

    question = question.strip()

    if not question:
        return {
            "answer": "Please enter a support question.",
            "sources": [],
            "needs_human": False,
        }

    # Search the existing knowledge database.
    articles = search_articles(question, limit=5)

    if not articles:
        return {
            "answer": (
                "I couldn't find relevant information in the "
                "support knowledge base. Please contact a human "
                "support expert for assistance."
            ),
            "sources": [],
            "needs_human": True,
        }

    sources = []
    context_parts = []

    # Prepare article content and source URLs.
    for article in articles:
        url = article.get("url", "")
        title = article.get("title", "Support article")
        content = article.get("content", "")

        if url:
            sources.append({
                "title": title,
                "url": url,
            })

        if content:
            context_parts.append(
                f"Title: {title}\n"
                f"URL: {url}\n"
                f"Content:\n{content[:4000]}"
            )

    # Provide retrieved content if no API key is configured.
    if client is None:
        return {
            "answer": (
                "The AI service is not configured. Here is the "
                "relevant information retrieved from the knowledge "
                "base:\n\n"
                + "\n\n---\n\n".join(context_parts[:3])
            ),
            "sources": sources,
            "needs_human": True,
        }

    if not context_parts:
        return {
            "answer": (
                "Relevant article records were found, but they "
                "contain no usable text. Please contact human support."
            ),
            "sources": sources,
            "needs_human": True,
        }

    context = "\n\n---\n\n".join(context_parts)

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a technical support assistant for "
                        "Brilliant Directories. Answer using only the "
                        "provided support articles. Do not invent "
                        "instructions or unsupported facts. If the "
                        "articles do not answer the question, clearly "
                        "say that you could not verify the answer and "
                        "recommend human support. Include relevant "
                        "source URLs in your answer."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"SUPPORT ARTICLES:\n{context}\n\n"
                        f"SUPPORT QUESTION:\n{question}"
                    ),
                },
            ],
            temperature=0.2,
            max_tokens=1000,
        )

        answer = response.choices[0].message.content or ""

        if not answer.strip():
            answer = (
                "The AI returned an empty response. "
                "Please contact human support."
            )

        answer_lower = answer.lower()

        needs_human = any(
            phrase in answer_lower
            for phrase in [
                "contact human support",
                "contact support",
                "could not verify",
                "couldn't verify",
                "not enough information",
                "cannot determine",
                "could not find",
            ]
        )

        return {
            "answer": answer,
            "sources": sources,
            "needs_human": needs_human,
        }

    except Exception as exc:
        # Log the error type without exposing credentials.
        print(f"Groq API error: {type(exc).__name__}")

        return {
            "answer": (
                "The AI service is temporarily unavailable. "
                "Please try again later or contact human support."
            ),
            "sources": sources,
            "needs_human": True,
        }


if __name__ == "__main__":
    question = input("Ask a support question: ")
    result = answer_question(question)

    print("\nANSWER:\n")
    print(result["answer"])

    print("\nSOURCES:\n")

    for source in result["sources"]:
        print(f"{source['title']}: {source['url']}")

    print("\nNeeds human support:", result["needs_human"])