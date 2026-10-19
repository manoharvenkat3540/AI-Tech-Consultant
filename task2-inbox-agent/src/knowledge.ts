import fs from "node:fs";
import path from "node:path";

export interface KnowledgeDocument {
    id: string;
    category: string;
    title: string;
    content: string;
    keywords: string[];
}

export interface KnowledgeResult {
    id: string;
    title: string;
    content: string;
    category: string;
    score: number;
}

const KNOWLEDGE_PATH = path.resolve(
    process.cwd(),
    "data",
    "knowledge.json"
);

function normalize(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFKC")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function tokenize(text: string): string[] {
    return normalize(text)
        .split(" ")
        .filter((word) => word.length >= 3);
}

function loadKnowledge(): KnowledgeDocument[] {
    try {
        if (!fs.existsSync(KNOWLEDGE_PATH)) {
            console.warn(
                `Knowledge file not found: ${KNOWLEDGE_PATH}`
            );
            return [];
        }

        const rawData = fs.readFileSync(
            KNOWLEDGE_PATH,
            "utf-8"
        );

        const parsed: unknown = JSON.parse(rawData);

        if (!Array.isArray(parsed)) {
            throw new Error(
                "Knowledge file must contain a JSON array."
            );
        }

        return parsed.filter(
            (item): item is KnowledgeDocument => {
                if (
                    typeof item !== "object" ||
                    item === null
                ) {
                    return false;
                }

                const document = item as Record<
                    string,
                    unknown
                >;

                return (
                    typeof document.id === "string" &&
                    typeof document.category === "string" &&
                    typeof document.title === "string" &&
                    typeof document.content === "string" &&
                    Array.isArray(document.keywords) &&
                    document.keywords.every(
                        (keyword: unknown) =>
                            typeof keyword === "string"
                    )
                );
            }
        );
    } catch (error) {
        console.error(
            "Failed to load knowledge base:",
            error instanceof Error
                ? error.message
                : error
        );

        return [];
    }
}

// Detect the main issue category.
function inferTopic(query: string): string | null {
    const text = normalize(query);

    const topicPatterns: Record<string, string[]> = {
        billing: [
            "payment",
            "invoice",
            "billing",
            "refund",
            "transaction",
            "money back",
            "payment reversal"
        ],

        account_access: [
            "password",
            "login",
            "sign in",
            "account access",
            "reset password",
            "locked account"
        ],

        domain_support: [
            "domain",
            "dns",
            "website",
            "website not opening",
            "domain configuration",
            "dns records"
        ]
    };

    const matches = Object.entries(topicPatterns)
        .map(([topic, patterns]) => ({
            topic,
            count: patterns.filter((pattern) =>
                ` ${text} `.includes(
                    ` ${normalize(pattern)} `
                )
            ).length
        }))
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count);

    if (matches.length === 0) {
        return null;
    }

    // Avoid choosing a category when the top scores are tied.
    if (
        matches.length > 1 &&
        matches[0].count === matches[1].count
    ) {
        return null;
    }

    return matches[0].topic;
}

function calculateScore(
    document: KnowledgeDocument,
    query: string,
    category: string,
    topic: string | null
): number {
    const normalizedQuery = normalize(query);
    const queryTokens = new Set(tokenize(query));
    const titleTokens = new Set(tokenize(document.title));
    const contentTokens = new Set(tokenize(document.content));

    const documentCategory = normalize(document.category);
    const requestedCategory = normalize(category);

    // If a clear topic was detected, don't return another category.
    if (
        topic !== null &&
        documentCategory !== normalize(topic)
    ) {
        return 0;
    }

    let score = 0;
    let matchedKeyword = false;
    let matchedTitle = false;

    if (
        requestedCategory &&
        documentCategory === requestedCategory
    ) {
        score += 2;
    }

    for (const rawKeyword of document.keywords) {
        const keyword = normalize(rawKeyword);

        if (!keyword) {
            continue;
        }

        const matched = keyword.includes(" ")
            ? ` ${normalizedQuery} `.includes(` ${keyword} `)
            : queryTokens.has(keyword);

        if (matched) {
            matchedKeyword = true;
            score += keyword.includes(" ") ? 8 : 4;
        }
    }

    for (const token of queryTokens) {
        if (titleTokens.has(token)) {
            matchedTitle = true;
            score += 3;
        }
    }

    for (const token of queryTokens) {
        if (contentTokens.has(token)) {
            score += 1;
        }
    }

    // Require an actual keyword or title match.
    if (!matchedKeyword && !matchedTitle) {
        return 0;
    }

    return score;
}

export function searchKnowledge(
    query: string,
    category: string,
    limit = 3
): KnowledgeResult[] {
    if (!query.trim() || limit <= 0) {
        return [];
    }

    const documents = loadKnowledge();
    const inferredTopic = inferTopic(query);
    const effectiveCategory = inferredTopic ?? category;

    return documents
        .map((document) => ({
            id: document.id,
            title: document.title,
            content: document.content,
            category: document.category,
            score: calculateScore(
                document,
                query,
                effectiveCategory,
                inferredTopic
            )
        }))
        .filter((document) => document.score >= 5)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}