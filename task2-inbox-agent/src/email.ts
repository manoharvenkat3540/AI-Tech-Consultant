import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";

import {
    persistDraft,
    getEmailHistory,
    getStoredDraft,
    getEmailAnalytics,
    type DraftRecord,
    type ReviewStatus,
} from "./database.js";

const emailRouter = Router();

/* =========================
   HELPERS
========================= */

function errorMessage(error: unknown): string {
    return error instanceof Error
        ? error.message
        : "An unexpected error occurred.";
}

function getId(req: Request): string {
    return typeof req.params.id === "string"
        ? req.params.id
        : "";
}

/* =========================
   HEALTH CHECK
========================= */

emailRouter.get("/health", (_req, res) => {
    res.json({
        success: true,
        message: "AI Inbox Agent backend is running.",
    });
});

/* =========================
   EMAIL HISTORY
========================= */

emailRouter.get("/", (_req, res) => {
    try {
        res.json({
            success: true,
            emails: getEmailHistory(),
        });
    } catch (error) {
        console.error("History error:", error);

        res.status(500).json({
            success: false,
            error: errorMessage(error),
        });
    }
});

// Compatibility with older frontend versions.
emailRouter.get("/history", (_req, res) => {
    try {
        res.json({
            success: true,
            emails: getEmailHistory(),
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: errorMessage(error),
        });
    }
});

/* =========================
   ANALYTICS
========================= */

emailRouter.get("/analytics", (_req, res) => {
    try {
        res.json({
            success: true,
            analytics: getEmailAnalytics(),
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: errorMessage(error),
        });
    }
});

/* =========================
   GROQ AI EMAIL ANALYSIS
========================= */

emailRouter.post(
    ["/analyze", "/draft"],
    async (req: Request, res: Response): Promise<void> => {
        try {
            const payload = req.body ?? {};
            const nestedEmail = payload.email ?? {};

            const sender =
                payload.from ??
                payload.emailAddress ??
                nestedEmail.from ??
                "";

            const subject =
                payload.subject ??
                nestedEmail.subject ??
                "";

            const body =
                payload.body ??
                payload.message ??
                payload.customerMessage ??
                nestedEmail.body ??
                "";

            if (
                typeof sender !== "string" ||
                typeof subject !== "string" ||
                typeof body !== "string" ||
                !sender.trim() ||
                !subject.trim() ||
                !body.trim()
            ) {
                res.status(400).json({
                    success: false,
                    error: "Sender email, subject, and message are required.",
                });
                return;
            }

            const apiKey = process.env.GROQ_API_KEY;

            if (!apiKey) {
                res.status(500).json({
                    success: false,
                    error: "GROQ_API_KEY is missing from your .env file.",
                });
                return;
            }

            const model =
                process.env.GROQ_MODEL || "openai/gpt-oss-120b";

            const response = await fetch(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model,
                        temperature: 0.4,
                        response_format: {
                            type: "json_object",
                        },
                        messages: [
                            {
                                role: "system",
                                content: `
You are a professional enterprise customer-support assistant.

Analyze the customer's email and create a helpful, polite,
context-aware reply.

Do not invent company policies, claim that actions have been
completed, or make promises that are not confirmed.

Return valid JSON containing:
{
  "category": "short email category",
  "draft": "professional email reply"
}
                                `.trim(),
                            },
                            {
                                role: "user",
                                content:
                                    `Sender: ${sender}\n` +
                                    `Subject: ${subject}\n` +
                                    `Message: ${body}`,
                            },
                        ],
                    }),
                }
            );

            if (!response.ok) {
                const details = await response.text();

                console.error("Groq API error:", response.status, details);

                res.status(502).json({
                    success: false,
                    error: "Groq could not generate a reply. Check your API key and model.",
                });
                return;
            }

            const result = await response.json() as {
                choices?: {
                    message?: {
                        content?: string | null;
                    };
                }[];
            };

            const content = result.choices?.[0]?.message?.content;

            if (!content) {
                res.status(502).json({
                    success: false,
                    error: "Groq returned an empty response.",
                });
                return;
            }

            let generated: {
                category?: unknown;
                draft?: unknown;
            };

            try {
                generated = JSON.parse(content);
            } catch {
                res.status(502).json({
                    success: false,
                    error: "Groq returned invalid JSON.",
                });
                return;
            }

            if (
                typeof generated.category !== "string" ||
                typeof generated.draft !== "string" ||
                !generated.draft.trim()
            ) {
                res.status(502).json({
                    success: false,
                    error: "The AI response is missing its category or draft.",
                });
                return;
            }

            const now = new Date().toISOString();

            const record: DraftRecord = {
                id: randomUUID(),

                email: {
                    from: sender,
                    subject,
                    body,
                },

                category: generated.category,
                draft: generated.draft,
                originalDraft: generated.draft,
                status: "awaiting_human_review",
                createdAt: now,
                updatedAt: now,
                editHistory: [],
            };

            persistDraft(record);

            res.json({
                success: true,
                message: "Email analyzed and draft generated successfully.",
                id: record.id,
                email: record.email,
                category: record.category,
                draft: record.draft,
                originalDraft: record.originalDraft,
                status: record.status,
                knowledgeSources: [],
            });
        } catch (error) {
            console.error("Email analysis error:", error);

            res.status(500).json({
                success: false,
                error: errorMessage(error),
            });
        }
    }
);

/* =========================
   UPDATE DRAFT
========================= */

emailRouter.put(
    ["/:id/draft", "/:id"],
    (req: Request, res: Response): void => {
        try {
            const id = getId(req);
            const existing = getStoredDraft(id);

            if (!existing) {
                res.status(404).json({
                    success: false,
                    error: "Draft not found.",
                });
                return;
            }

            if (existing.status !== "awaiting_human_review") {
                res.status(409).json({
                    success: false,
                    error: "Only drafts awaiting review can be edited.",
                });
                return;
            }

            const draft =
                typeof req.body?.draft === "string"
                    ? req.body.draft
                    : typeof req.body?.body === "string"
                        ? req.body.body
                        : "";

            if (!draft.trim()) {
                res.status(400).json({
                    success: false,
                    error: "Draft text cannot be empty.",
                });
                return;
            }

            const now = new Date().toISOString();

            const updated: DraftRecord = {
                ...existing,
                draft,
                updatedAt: now,
                editHistory: [
                    ...existing.editHistory,
                    {
                        previousDraft: existing.draft,
                        updatedAt: now,
                    },
                ],
            };

            persistDraft(updated);

            res.json({
                success: true,
                message: "Draft updated successfully.",
                id: updated.id,
                email: updated.email,
                draft: updated.draft,
                status: updated.status,
                editHistory: updated.editHistory,
            });
        } catch (error) {
            console.error("Draft update error:", error);

            res.status(500).json({
                success: false,
                error: errorMessage(error),
            });
        }
    }
);

/* =========================
   APPROVE / REJECT
========================= */

emailRouter.post(
    ["/:id/review", "/:id/approve", "/:id/reject"],
    (req: Request, res: Response): void => {
        try {
            const id = getId(req);
            const existing = getStoredDraft(id);

            if (!existing) {
                res.status(404).json({
                    success: false,
                    error: "Draft not found.",
                });
                return;
            }

            let requestedStatus = req.body?.status;

            if (req.path.endsWith("/approve")) {
                requestedStatus = "approved";
            }

            if (req.path.endsWith("/reject")) {
                requestedStatus = "rejected";
            }

            if (
                requestedStatus !== "approved" &&
                requestedStatus !== "rejected"
            ) {
                res.status(400).json({
                    success: false,
                    error: "Status must be approved or rejected.",
                });
                return;
            }

            if (existing.status !== "awaiting_human_review") {
                res.status(409).json({
                    success: false,
                    error: "This draft has already been reviewed.",
                });
                return;
            }

            const status: ReviewStatus = requestedStatus;

            const updated: DraftRecord = {
                ...existing,
                status,
                updatedAt: new Date().toISOString(),
            };

            persistDraft(updated);

            res.json({
                success: true,
                message: `Email ${status} successfully.`,
                id: updated.id,
                email: updated.email,
                draft: updated.draft,
                status: updated.status,
            });
        } catch (error) {
            console.error("Review error:", error);

            res.status(500).json({
                success: false,
                error: errorMessage(error),
            });
        }
    }
);

/* =========================
   SEND APPROVED EMAIL
========================= */

emailRouter.post("/:id/send", async (req, res): Promise<void> => {
    const id = getId(req);
    const existing = getStoredDraft(id);

    if (!existing) {
        res.status(404).json({
            success: false,
            error: "Draft not found.",
        });
        return;
    }

    if (existing.status !== "approved") {
        res.status(409).json({
            success: false,
            error: "Approve the draft before sending it.",
        });
        return;
    }

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
        res.status(500).json({
            success: false,
            error: "Configure SMTP_USER and SMTP_PASS in your .env file.",
        });
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(existing.email.from)) {
        res.status(400).json({
            success: false,
            error: "The customer's email address is invalid.",
        });
        return;
    }

    const sending: DraftRecord = {
        ...existing,
        status: "sending",
        updatedAt: new Date().toISOString(),
    };

    persistDraft(sending);

    try {
        const port = Number(process.env.SMTP_PORT || 465);

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || "smtp.gmail.com",
            port,
            secure:
                process.env.SMTP_SECURE
                    ? process.env.SMTP_SECURE === "true"
                    : port === 465,
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });

        await transporter.sendMail({
            from: process.env.SMTP_FROM || smtpUser,
            to: existing.email.from,
            subject: `Re: ${existing.email.subject}`,
            text: existing.draft,
        });

        const sent: DraftRecord = {
            ...sending,
            status: "sent",
            updatedAt: new Date().toISOString(),
        };

        persistDraft(sent);

        res.json({
            success: true,
            message: "Approved email sent successfully.",
            id: sent.id,
            status: sent.status,
        });
    } catch (error) {
        console.error("SMTP sending error:", error);

        // Allow the user to retry if sending failed.
        const retryable: DraftRecord = {
            ...sending,
            status: "approved",
            updatedAt: new Date().toISOString(),
        };

        persistDraft(retryable);

        res.status(502).json({
            success: false,
            error: "Email could not be sent. Check your Gmail SMTP settings.",
        });
    }
});

/* =========================
   GET ONE EMAIL
========================= */

emailRouter.get("/:id", (req, res) => {
    try {
        const record = getStoredDraft(getId(req));

        if (!record) {
            res.status(404).json({
                success: false,
                error: "Email or draft not found.",
            });
            return;
        }

        res.json({
            success: true,
            email: record,
            draft: record.draft,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: errorMessage(error),
        });
    }
});

export default emailRouter;