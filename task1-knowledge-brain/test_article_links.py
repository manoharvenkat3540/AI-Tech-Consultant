import asyncio
import httpx

from app.crawler.articles import extract_article_links


async def main():
    url = (
        "https://support.brilliantdirectories.com/"
        "support/solutions/12000001519"
    )

    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=30,
        headers={
            "User-Agent": "AITechConsultantKnowledgeBot/1.0"
        },
    ) as client:
        response = await client.get(url)
        response.raise_for_status()

        links = extract_article_links(response.text, url)

        print("Links found:", len(links))

        for link in links[:15]:
            print(link)


if __name__ == "__main__":
    asyncio.run(main())