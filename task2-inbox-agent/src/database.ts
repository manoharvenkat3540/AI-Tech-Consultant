import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type ReviewStatus =
  | "awaiting_human_review"
  | "approved"
  | "sending"
  | "rejected"
  | "sent";

export interface DraftRecord {
  id: string;
  email: {
    from: string;
    subject: string;
    body: string;
  };
  category: string;
  draft: string;
  originalDraft: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  editHistory: {
    previousDraft: string;
    updatedAt: string;
  }[];
}

export interface EmailAnalytics {
  totalEmails: number;
  pendingReview: number;
  approved: number;
  sending: number;
  sent: number;
  rejected: number;
}

const dataDirectory = path.resolve(process.cwd(), "data");

fs.mkdirSync(dataDirectory, { recursive: true });

const databasePath = path.join(dataDirectory, "inbox-agent.db");
const db = new Database(databasePath);

db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS email_drafts (
    id TEXT PRIMARY KEY,
    sender TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT NOT NULL,
    draft TEXT NOT NULL,
    original_draft TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    edit_history TEXT NOT NULL DEFAULT '[]'
  );

  CREATE INDEX IF NOT EXISTS idx_email_drafts_created_at
    ON email_drafts(created_at);

  CREATE INDEX IF NOT EXISTS idx_email_drafts_status
    ON email_drafts(status);
`);

const upsertStatement = db.prepare(`
  INSERT INTO email_drafts (
    id, sender, subject, body, category, draft,
    original_draft, status, created_at, updated_at, edit_history
  )
  VALUES (
    @id, @sender, @subject, @body, @category, @draft,
    @original_draft, @status, @created_at, @updated_at, @edit_history
  )
  ON CONFLICT(id) DO UPDATE SET
    sender = excluded.sender,
    subject = excluded.subject,
    body = excluded.body,
    category = excluded.category,
    draft = excluded.draft,
    original_draft = excluded.original_draft,
    status = excluded.status,
    updated_at = excluded.updated_at,
    edit_history = excluded.edit_history
`);

function parseEditHistory(value: unknown): DraftRecord["editHistory"] {
  try {
    const parsed: unknown = JSON.parse(String(value ?? "[]"));

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is DraftRecord["editHistory"][number] =>
        typeof item?.previousDraft === "string" &&
        typeof item?.updatedAt === "string"
    );
  } catch {
    return [];
  }
}

function loadDrafts(): DraftRecord[] {
  const rows = db
    .prepare("SELECT * FROM email_drafts ORDER BY created_at DESC")
    .all() as Record<string, unknown>[];

  return rows.map((row) => ({
    id: String(row.id),
    email: {
      from: String(row.sender),
      subject: String(row.subject),
      body: String(row.body),
    },
    category: String(row.category),
    draft: String(row.draft),
    originalDraft: String(row.original_draft),
    status: row.status as ReviewStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    editHistory: parseEditHistory(row.edit_history),
  }));
}

export const drafts = new Map<string, DraftRecord>(
  loadDrafts().map((record) => [record.id, record])
);

export function persistDraft(record: DraftRecord): void {
  const transaction = db.transaction((item: DraftRecord) => {
    upsertStatement.run({
      id: item.id,
      sender: item.email.from,
      subject: item.email.subject,
      body: item.email.body,
      category: item.category,
      draft: item.draft,
      original_draft: item.originalDraft,
      status: item.status,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
      edit_history: JSON.stringify(item.editHistory),
    });
  });

  transaction(record);
  drafts.set(record.id, record);
}

export function getEmailHistory(): DraftRecord[] {
  return loadDrafts();
}

export function getStoredDraft(
  id: string
): DraftRecord | undefined {
  return drafts.get(id);
}

export function getEmailAnalytics(): EmailAnalytics {
  const result = db.prepare(`
    SELECT
      COUNT(*) AS totalEmails,
      SUM(CASE WHEN status = 'awaiting_human_review' THEN 1 ELSE 0 END) AS pendingReview,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN status = 'sending' THEN 1 ELSE 0 END) AS sending,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
    FROM email_drafts
  `).get() as EmailAnalytics;

  return {
    totalEmails: result.totalEmails ?? 0,
    pendingReview: result.pendingReview ?? 0,
    approved: result.approved ?? 0,
    sending: result.sending ?? 0,
    sent: result.sent ?? 0,
    rejected: result.rejected ?? 0,
  };
}

console.log(`SQLite database initialized: ${databasePath}`);