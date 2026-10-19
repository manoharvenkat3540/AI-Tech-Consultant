import { describe, it, expect } from "vitest";
import { searchKnowledge } from "../src/knowledge.js";

describe("Knowledge Brain - Automated Tests", () => {
    it("should retrieve Payment and Invoice Policy for billing emails", () => {
        const results = searchKnowledge(
            "Payment deducted but invoice not received. Check payment status.",
            "billing",
            3
        );

        expect(results.length).toBeGreaterThan(0);

        expect(results[0].id).toBe("billing-001");
        expect(results[0].title).toBe(
            "Payment and Invoice Policy"
        );
    });

    it("should retrieve Account Login Support for password problems", () => {
        const results = searchKnowledge(
            "I cannot log in because my password is not working. I need to reset my password.",
            "account_access",
            3
        );

        expect(results.length).toBeGreaterThan(0);

        expect(
            results.some(
                (document) => document.id === "account-001"
            )
        ).toBe(true);
    });

    it("should retrieve Domain and DNS Troubleshooting for DNS problems", () => {
        const results = searchKnowledge(
            "My domain is not resolving after a DNS configuration change. Please check my DNS records.",
            "domain_support",
            3
        );

        expect(results.length).toBeGreaterThan(0);

        expect(results[0].id).toBe("domain-001");
        expect(results[0].title).toBe(
            "Domain and DNS Troubleshooting"
        );
    });

    it("should not return account documents for a clear billing query", () => {
        const results = searchKnowledge(
            "My payment was deducted, but I did not receive my invoice.",
            "billing",
            3
        );

        expect(
            results.some(
                (document) => document.category === "account_access"
            )
        ).toBe(false);

        expect(
            results.some(
                (document) => document.category === "domain_support"
            )
        ).toBe(false);
    });

    it("should return no results for an empty query", () => {
        const results = searchKnowledge(
            "",
            "billing",
            3
        );

        expect(results).toEqual([]);
    });

    it("should return no results when the result limit is zero", () => {
        const results = searchKnowledge(
            "Payment deducted but invoice not received",
            "billing",
            0
        );

        expect(results).toEqual([]);
    });

    it("should respect the requested result limit", () => {
        const results = searchKnowledge(
            "payment invoice billing transaction",
            "billing",
            1
        );

        expect(results.length).toBeLessThanOrEqual(1);
    });

    it("should return results in descending score order", () => {
        const results = searchKnowledge(
            "payment deducted invoice missing payment status",
            "billing",
            3
        );

        for (let i = 1; i < results.length; i++) {
            expect(results[i - 1].score).toBeGreaterThanOrEqual(
                results[i].score
            );
        }
    });

    it("should return no results for an unrelated query", () => {
        const results = searchKnowledge(
            "What is the weather forecast for tomorrow?",
            "general_support",
            3
        );

        expect(results).toEqual([]);
    });
});