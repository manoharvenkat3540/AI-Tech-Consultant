"use strict";

const API_BASE = "/api/emails";

const $ = (id) => document.getElementById(id);

let currentDraftId = null;
let currentDraftStatus = null;
let originalDraft = "";
let emailsProcessed = 0;
let cachedEmailHistory = [];

const elements = {
    form: $("emailForm"),
    from: $("from"),
    subject: $("subject"),
    body: $("body"),

    analyzeButton: $("analyzeButton"),
    analyzeButtonText: $("analyzeButtonText"),

    errorContainer: $("errorContainer"),
    successContainer: $("successContainer"),

    emailsProcessed: $("emailsProcessed"),
    documentsRetrieved: $("documentsRetrieved"),
    dashboardStatus: $("dashboardStatus"),
    dashboardStatusDetail: $("dashboardStatusDetail"),

    categoryOutput: $("categoryOutput"),
    reviewStatus: $("reviewStatus"),

    emptyState: $("emptyState"),
    draftSection: $("draftSection"),
    draftOutput: $("draftOutput"),

    approveButton: $("approveButton"),
    rejectButton: $("rejectButton"),
    copyButton: $("copyButton"),
    saveDraftButton: $("saveDraftButton"),
    sendEmailButton: $("sendEmailButton"),

    modelOutput: $("modelOutput"),
    sourceBadge: $("sourceBadge"),
    sourcesList: $("sourcesList"),
    knowledgeStatus: $("knowledgeStatus"),
    characterCount: $("characterCount"),
    approvalNote: $("approvalNote"),

    historySearch: $("historySearch"),
    historyTableBody: $("historyTableBody"),
    historyCount: $("historyCount"),
    historyMessage: $("historyMessage"),
    refreshHistoryButton: $("refreshHistoryButton"),
    historyDetail: $("historyDetail"),
    closeHistoryDetail: $("closeHistoryDetail")
};

/* =========================
   API HELPERS
========================= */

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: "application/json",
            ...(options.body ? {
                "Content-Type": "application/json"
            } : {}),
            ...options.headers
        }
    });

    const text = await response.text();

    let data;

    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`Invalid server response. HTTP ${response.status}`);
    }

    if (!response.ok) {
        throw new Error(
            data.error ||
            data.message ||
            `Request failed. HTTP ${response.status}`
        );
    }

    return data;
}

/* =========================
   NOTIFICATIONS
========================= */

function clearMessages() {
    elements.errorContainer.hidden = true;
    elements.successContainer.hidden = true;

    elements.errorContainer.textContent = "";
    elements.successContainer.textContent = "";
}

function showError(message) {
    console.error(message);

    elements.errorContainer.textContent = message;
    elements.errorContainer.hidden = false;
    elements.successContainer.hidden = true;
}

function showSuccess(message) {
    elements.successContainer.textContent = message;
    elements.successContainer.hidden = false;
    elements.errorContainer.hidden = true;
}

function updateDashboardStatus(status, detail) {
    elements.dashboardStatus.textContent = status;
    elements.dashboardStatusDetail.textContent = detail || "";
}

function setSendButton(visible, disabled, text) {
    elements.sendEmailButton.hidden = !visible;
    elements.sendEmailButton.disabled = disabled;

    elements.sendEmailButton.textContent =
        text || "✉ Send Approved Email";
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

/* =========================
   CHARACTER COUNTER
========================= */

function updateCharacterCount() {
    elements.characterCount.textContent =
        `${elements.body.value.length} / 10000`;
}

/* =========================
   DISPLAY AI RESPONSE
========================= */

function displayDraft(data) {
    const record =
        data.email && typeof data.email === "object"
            ? data.email
            : data;

    currentDraftId = data.id || record.id;

    currentDraftStatus =
        data.status || record.status || "awaiting_human_review";

    originalDraft = data.draft || record.draft || "";

    elements.emptyState.hidden = true;
    elements.draftSection.hidden = false;

    elements.draftOutput.value = originalDraft;

    elements.categoryOutput.textContent =
        data.category || record.category || "General Support";

    elements.reviewStatus.textContent =
        currentDraftStatus.replaceAll("_", " ");

    elements.modelOutput.textContent = "Groq AI";

    const awaitingReview =
        currentDraftStatus === "awaiting_human_review";

    elements.approveButton.disabled = !awaitingReview;
    elements.rejectButton.disabled = !awaitingReview;
    elements.saveDraftButton.disabled = !awaitingReview;

    setSendButton(
        currentDraftStatus === "approved",
        currentDraftStatus !== "approved"
    );

    updateDashboardStatus(
        currentDraftStatus.replaceAll("_", " "),
        "Review the generated reply before sending."
    );

    renderSources(data.knowledgeSources || []);
}

function resetDraftView() {
    currentDraftId = null;
    currentDraftStatus = null;
    originalDraft = "";

    elements.draftSection.hidden = true;
    elements.emptyState.hidden = false;

    elements.categoryOutput.textContent = "Not analyzed";
    elements.reviewStatus.textContent = "Waiting";

    setSendButton(false, true);
}

/* =========================
   KNOWLEDGE SOURCES
========================= */

function renderSources(sources) {
    const list = Array.isArray(sources) ? sources : [];

    elements.documentsRetrieved.textContent = String(list.length);

    elements.sourceBadge.textContent =
        `${list.length} SOURCE${list.length === 1 ? "" : "S"}`;

    if (!list.length) {
        elements.knowledgeStatus.textContent =
            "No knowledge documents were returned by the backend.";

        elements.sourcesList.innerHTML =
            '<div class="source-empty">No knowledge sources retrieved.</div>';

        return;
    }

    elements.knowledgeStatus.textContent =
        "Knowledge sources returned by the backend.";

    elements.sourcesList.innerHTML = list.map(source => `
        <article class="source-card">
            <h3>${escapeHTML(source.title || "Knowledge document")}</h3>
            <p>${escapeHTML(source.category || "Knowledge")}</p>
        </article>
    `).join("");
}

/* =========================
   ANALYZE EMAIL
========================= */

async function analyzeEmail(event) {
    event.preventDefault();
    clearMessages();

    const payload = {
        from: elements.from.value.trim(),
        subject: elements.subject.value.trim(),
        body: elements.body.value.trim()
    };

    if (!payload.from || !payload.subject || !payload.body) {
        showError("Please complete all email fields.");
        return;
    }

    elements.analyzeButton.disabled = true;
    elements.analyzeButtonText.textContent = "Analyzing email...";

    updateDashboardStatus("Analyzing", "Generating your AI reply.");

    try {
        const data = await apiRequest(`${API_BASE}/analyze`, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        displayDraft(data);

        emailsProcessed++;
        elements.emailsProcessed.textContent = String(emailsProcessed);

        showSuccess(data.message || "AI reply generated successfully.");

        await loadEmailHistory();
    } catch (error) {
        showError(error.message || "Unable to analyze the email.");

        updateDashboardStatus("Error", "Email analysis failed.");
    } finally {
        elements.analyzeButton.disabled = false;
        elements.analyzeButtonText.textContent = "✦ Analyze Email with AI";
    }
}

/* =========================
   SAVE EDITED DRAFT
========================= */

async function saveEditedDraft() {
    clearMessages();

    if (!currentDraftId) {
        showError("Analyze an email before saving.");
        return;
    }

    if (currentDraftStatus !== "awaiting_human_review") {
        showError("Only drafts awaiting review can be edited.");
        return;
    }

    const draft = elements.draftOutput.value.trim();

    if (!draft) {
        showError("Draft cannot be empty.");
        return;
    }

    elements.saveDraftButton.disabled = true;
    elements.saveDraftButton.textContent = "Saving...";

    try {
        const data = await apiRequest(
            `${API_BASE}/${encodeURIComponent(currentDraftId)}/draft`,
            {
                method: "PUT",
                body: JSON.stringify({ draft })
            }
        );

        originalDraft = data.draft || draft;

        showSuccess(data.message || "Draft updated successfully.");

        await loadEmailHistory();
    } catch (error) {
        showError(error.message || "Unable to save draft.");
    } finally {
        elements.saveDraftButton.disabled =
            currentDraftStatus !== "awaiting_human_review";

        elements.saveDraftButton.textContent = "Save Changes";
    }
}

/* =========================
   APPROVE DRAFT
========================= */

async function approveDraft() {
    clearMessages();

    if (!currentDraftId) {
        showError("Generate a draft first.");
        return;
    }

    if (currentDraftStatus !== "awaiting_human_review") {
        showError("This draft has already been reviewed.");
        return;
    }

    const draft = elements.draftOutput.value.trim();

    if (!draft) {
        showError("Draft cannot be empty.");
        return;
    }

    elements.approveButton.disabled = true;

    try {
        if (draft !== originalDraft) {
            const saved = await apiRequest(
                `${API_BASE}/${encodeURIComponent(currentDraftId)}/draft`,
                {
                    method: "PUT",
                    body: JSON.stringify({ draft })
                }
            );

            originalDraft = saved.draft || draft;
        }

        const data = await apiRequest(
            `${API_BASE}/${encodeURIComponent(currentDraftId)}/review`,
            {
                method: "POST",
                body: JSON.stringify({ status: "approved" })
            }
        );

        currentDraftStatus = data.status || "approved";

        elements.reviewStatus.textContent =
            currentDraftStatus.replaceAll("_", " ");

        elements.approveButton.disabled = true;
        elements.rejectButton.disabled = true;
        elements.saveDraftButton.disabled = true;

        elements.approvalNote.textContent =
            "Draft approved. You can now send the email.";

        setSendButton(true, false);

        updateDashboardStatus("Approved", "Ready to send.");

        showSuccess(data.message || "Draft approved successfully.");

        await loadEmailHistory();
    } catch (error) {
        elements.approveButton.disabled = false;
        showError(error.message || "Unable to approve draft.");
    }
}

/* =========================
   REJECT DRAFT
========================= */

async function rejectDraft() {
    clearMessages();

    if (!currentDraftId) {
        showError("Generate a draft first.");
        return;
    }

    if (!window.confirm("Are you sure you want to reject this draft?")) {
        return;
    }

    elements.rejectButton.disabled = true;

    try {
        const data = await apiRequest(
            `${API_BASE}/${encodeURIComponent(currentDraftId)}/review`,
            {
                method: "POST",
                body: JSON.stringify({ status: "rejected" })
            }
        );

        currentDraftStatus = data.status || "rejected";

        elements.reviewStatus.textContent =
            currentDraftStatus.replaceAll("_", " ");

        elements.approveButton.disabled = true;
        elements.saveDraftButton.disabled = true;

        setSendButton(false, true);

        updateDashboardStatus("Rejected", "The draft was rejected.");

        showSuccess(data.message || "Draft rejected.");

        await loadEmailHistory();
    } catch (error) {
        elements.rejectButton.disabled = false;
        showError(error.message || "Unable to reject draft.");
    }
}

/* =========================
   SEND APPROVED EMAIL
========================= */

async function sendApprovedEmail() {
    clearMessages();

    if (!currentDraftId || currentDraftStatus !== "approved") {
        showError("Approve the draft before sending.");
        return;
    }

    const confirmed = window.confirm(
        `Send this approved reply to ${elements.from.value.trim()}?`
    );

    if (!confirmed) return;

    setSendButton(true, true, "Sending email...");

    try {
        const data = await apiRequest(
            `${API_BASE}/${encodeURIComponent(currentDraftId)}/send`,
            {
                method: "POST",
                body: JSON.stringify({})
            }
        );

        currentDraftStatus = data.status || "sent";

        elements.reviewStatus.textContent =
            currentDraftStatus.replaceAll("_", " ");

        elements.approvalNote.textContent =
            "The approved email has been sent successfully.";

        setSendButton(false, true);

        updateDashboardStatus("Sent", "Email sent successfully.");

        showSuccess(data.message || "Email sent successfully.");

        await loadEmailHistory();
    } catch (error) {
        setSendButton(true, false);

        showError(error.message || "Unable to send email.");
    }
}

/* =========================
   COPY DRAFT
========================= */

async function copyDraft() {
    const text = elements.draftOutput.value;

    if (!text.trim()) {
        showError("There is no draft to copy.");
        return;
    }

    try {
        await navigator.clipboard.writeText(text);
        showSuccess("Draft copied to clipboard.");
    } catch {
        elements.draftOutput.select();

        if (document.execCommand("copy")) {
            showSuccess("Draft copied to clipboard.");
        } else {
            showError("Unable to copy the draft.");
        }
    }
}

/* =========================
   SAMPLE EMAILS
========================= */

const sampleEmails = {
    billing: {
        from: "customer@example.com",
        subject: "Payment issue with my invoice",
        body: "I completed my payment, but my account still shows an unpaid invoice. Could you please check this issue?"
    },

    account: {
        from: "customer@example.com",
        subject: "Unable to access my account",
        body: "I am unable to log in to my account. Could you please help me resolve this issue?"
    },

    domain: {
        from: "customer@example.com",
        subject: "My domain is not connecting",
        body: "I connected my domain to my website, but my website is still not opening. Could you please help me fix it?"
    }
};

function loadSampleEmail(type) {
    const sample = sampleEmails[type];

    if (!sample) return;

    elements.from.value = sample.from;
    elements.subject.value = sample.subject;
    elements.body.value = sample.body;

    updateCharacterCount();
    clearMessages();
    resetDraftView();

    updateDashboardStatus("Ready", "Sample email loaded.");
}

/* =========================
   EMAIL HISTORY
========================= */

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleString();
}

function renderEmailHistory(records) {
    if (!records.length) {
        elements.historyTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="history-empty">
                    No saved emails found.
                </td>
            </tr>
        `;

        elements.historyCount.textContent = "0 emails";
        return;
    }

    elements.historyTableBody.innerHTML = records.map(record => {
        const email = record.email || {};

        return `
            <tr>
                <td>${escapeHTML(email.from || "—")}</td>
                <td>${escapeHTML(email.subject || "—")}</td>
                <td>${escapeHTML(record.category || "—")}</td>
                <td>
                    <span class="history-status">
                        ${escapeHTML(
                            String(record.status || "unknown").replaceAll("_", " ")
                        )}
                    </span>
                </td>
                <td>${escapeHTML(formatDate(record.updatedAt || record.createdAt))}</td>
                <td>
                    <button
                        type="button"
                        class="history-view-button"
                        data-history-id="${escapeHTML(record.id)}"
                    >
                        View
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    elements.historyCount.textContent =
        `${records.length} email${records.length === 1 ? "" : "s"}`;
}

async function loadEmailHistory() {
    elements.historyCount.textContent = "Loading...";
    elements.refreshHistoryButton.disabled = true;

    try {
        const data = await apiRequest(`${API_BASE}/`);

        cachedEmailHistory = Array.isArray(data.emails)
            ? data.emails
            : [];

        const term = elements.historySearch.value.trim().toLowerCase();

        const filtered = term
            ? cachedEmailHistory.filter(record => {
                const email = record.email || {};

                return [
                    email.from,
                    email.subject,
                    email.body,
                    record.category,
                    record.draft,
                    record.status
                ].some(value =>
                    String(value || "").toLowerCase().includes(term)
                );
            })
            : cachedEmailHistory;

        renderEmailHistory(filtered);
        elements.historyMessage.hidden = true;
    } catch (error) {
        elements.historyCount.textContent = "Unavailable";
        elements.historyMessage.textContent = error.message;
        elements.historyMessage.hidden = false;

        elements.historyTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="history-empty">
                    Unable to load email history.
                </td>
            </tr>
        `;
    } finally {
        elements.refreshHistoryButton.disabled = false;
    }
}

async function showEmailDetails(id) {
    try {
        const data = await apiRequest(
            `${API_BASE}/${encodeURIComponent(id)}`
        );

        const record = data.email || data;
        const email = record.email || {};

        $("detailSender").textContent = email.from || "—";
        $("detailSubject").textContent = email.subject || "—";
        $("detailCategory").textContent = record.category || "—";

        $("detailStatus").textContent =
            String(record.status || "unknown").replaceAll("_", " ");

        $("detailCreated").textContent = formatDate(record.createdAt);
        $("detailUpdated").textContent = formatDate(record.updatedAt);

        $("detailBody").textContent = email.body || "";
        $("detailDraft").textContent = record.draft || "";

        elements.historyDetail.hidden = false;

        elements.historyDetail.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    } catch (error) {
        elements.historyMessage.textContent = error.message;
        elements.historyMessage.hidden = false;
    }
}

/* =========================
   INITIALIZE
========================= */

document.addEventListener("DOMContentLoaded", () => {
    elements.form.addEventListener("submit", analyzeEmail);

    elements.saveDraftButton.addEventListener("click", saveEditedDraft);
    elements.approveButton.addEventListener("click", approveDraft);
    elements.rejectButton.addEventListener("click", rejectDraft);
    elements.copyButton.addEventListener("click", copyDraft);
    elements.sendEmailButton.addEventListener("click", sendApprovedEmail);

    elements.body.addEventListener("input", updateCharacterCount);

    document.querySelectorAll("[data-sample]").forEach(button => {
        button.addEventListener("click", () => {
            loadSampleEmail(button.dataset.sample);
        });
    });

    elements.refreshHistoryButton.addEventListener(
        "click",
        loadEmailHistory
    );

    elements.historySearch.addEventListener("input", loadEmailHistory);

    elements.historyTableBody.addEventListener("click", event => {
        const button = event.target.closest("[data-history-id]");

        if (button) {
            showEmailDetails(button.dataset.historyId);
        }
    });

    elements.closeHistoryDetail.addEventListener("click", () => {
        elements.historyDetail.hidden = true;
    });

    updateCharacterCount();

    fetch("/health")
        .then(response => {
            if (!response.ok) {
                throw new Error("Backend health check failed.");
            }

            return response.json();
        })
        .then(data => console.log("Backend connected:", data))
        .catch(error => console.error(error));

    loadEmailHistory();

    updateDashboardStatus(
        "Ready",
        "Human approval is required before sending."
    );
});