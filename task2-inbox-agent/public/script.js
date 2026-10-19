"use strict";

// Frontend and backend use the same origin.
const API_BASE = "/api/emails";

// DOM helper.
const $ = (id) => document.getElementById(id);

// HTML elements.
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
    draftMode: $("draftMode"),

    approveButton: $("approveButton"),
    rejectButton: $("rejectButton"),
    copyButton: $("copyButton"),
    saveDraftButton: $("saveDraftButton"),

    modelOutput: $("modelOutput"),

    sourceBadge: $("sourceBadge"),
    sourcesList: $("sourcesList"),

    knowledgeStatus: $("knowledgeStatus"),
    characterCount: $("characterCount")
};

// Current draft information.
let currentDraftId = null;
let currentDraftStatus = null;
let originalDraft = "";
let emailsProcessed = 0;

// Escape HTML before displaying untrusted text.
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return replacements[character];
    });
}

// Display an error message.
function showError(message) {
    elements.errorContainer.textContent = message;
    elements.errorContainer.hidden = false;
    elements.successContainer.hidden = true;
}

// Display a success message.
function showSuccess(message) {
    elements.successContainer.textContent = message;
    elements.successContainer.hidden = false;
    elements.errorContainer.hidden = true;
}

// Clear messages.
function clearMessages() {
    elements.errorContainer.hidden = true;
    elements.successContainer.hidden = true;

    elements.errorContainer.textContent = "";
    elements.successContainer.textContent = "";
}

// Read and validate API responses.
async function readResponse(response) {
    const text = await response.text();

    let data;

    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(
            `Unexpected server response. HTTP ${response.status}.`
        );
    }

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            `Request failed. HTTP ${response.status}.`
        );
    }

    return data;
}

// Update the Analyze button and dashboard.
function setLoading(isLoading) {
    elements.analyzeButton.disabled = isLoading;

    elements.analyzeButtonText.textContent = isLoading
        ? "Generating AI response..."
        : "Analyze Email with AI";

    elements.analyzeButton.setAttribute(
        "aria-busy",
        String(isLoading)
    );

    elements.knowledgeStatus.textContent = isLoading
        ? "Analyzing email..."
        : currentDraftId
            ? "Analysis completed"
            : "Awaiting analysis";

    elements.dashboardStatus.textContent = isLoading
        ? "Processing"
        : currentDraftStatus === "awaiting_human_review"
            ? "Review"
            : currentDraftStatus === "approved"
                ? "Approved"
                : currentDraftStatus === "rejected"
                    ? "Rejected"
                    : "Ready";
}

// Display retrieved knowledge sources.
function renderSources(sources) {
    const safeSources = Array.isArray(sources) ? sources : [];

    elements.documentsRetrieved.textContent =
        String(safeSources.length);

    elements.sourceBadge.textContent =
        `${safeSources.length} SOURCE${safeSources.length === 1 ? "" : "S"}`;

    if (safeSources.length === 0) {
        elements.sourcesList.innerHTML = `
            <div class="no-sources">
                <div class="source-icon">◇</div>
                <div>
                    <strong>No knowledge sources returned</strong>
                    <p>
                        No matching knowledge documents were returned
                        for this email.
                    </p>
                </div>
            </div>
        `;

        return;
    }

    elements.sourcesList.innerHTML = safeSources.map((source) => {
        const title = escapeHTML(
            source.title || "Untitled document"
        );

        const category = escapeHTML(
            source.category || "General"
        );

        const score = Number(
            source.relevance_score ?? source.score
        );

        const scoreText = Number.isFinite(score)
            ? `Relevance score: ${score}`
            : "Relevant knowledge document";

        return `
            <article class="source-card">
                <div class="source-icon">◇</div>
                <div>
                    <strong>${title}</strong>
                    <p>Category: ${category}</p>
                    <span class="source-meta">
                        ${escapeHTML(scoreText)}
                    </span>
                </div>
            </article>
        `;
    }).join("");
}

// Reset the draft area before new analysis.
function resetDraftView() {
    currentDraftId = null;
    currentDraftStatus = null;
    originalDraft = "";

    elements.draftOutput.value = "";
    elements.draftSection.hidden = true;
    elements.emptyState.hidden = false;

    elements.categoryOutput.textContent = "Analyzing...";
    elements.reviewStatus.textContent = "Processing";
    elements.modelOutput.textContent = "Connecting...";

    elements.approveButton.disabled = true;
    elements.rejectButton.disabled = true;
    elements.copyButton.disabled = true;

    if (elements.saveDraftButton) {
        elements.saveDraftButton.disabled = true;
    }

    renderSources([]);
}

// Display the generated draft.
function displayDraft(data) {
    if (
        !data ||
        typeof data.id !== "string" ||
        typeof data.draft !== "string" ||
        !data.draft.trim()
    ) {
        throw new Error(
            "The backend response does not contain a valid draft ID and draft."
        );
    }

    currentDraftId = data.id;

    currentDraftStatus =
        data.status || "awaiting_human_review";

    originalDraft = data.draft;

    elements.emptyState.hidden = true;
    elements.draftSection.hidden = false;

    elements.draftOutput.value = data.draft;

    elements.categoryOutput.textContent =
        data.category || "General support";

    elements.reviewStatus.textContent =
        currentDraftStatus.replaceAll("_", " ");

    elements.modelOutput.textContent =
        data.ai?.model || "Configured model";

    elements.dashboardStatus.textContent = "Review";

    elements.dashboardStatusDetail.textContent =
        "Human approval required";

    elements.draftMode.textContent =
        "Edit the draft before review";

    elements.approveButton.disabled = false;
    elements.rejectButton.disabled = false;
    elements.copyButton.disabled = false;

    if (elements.saveDraftButton) {
        elements.saveDraftButton.disabled = false;
    }

    renderSources(data.knowledge?.sources || []);
}

// Analyze an email using the backend.
async function analyzeEmail(event) {
    event.preventDefault();
    clearMessages();

    const email = {
        from: elements.from.value.trim(),
        subject: elements.subject.value.trim(),
        body: elements.body.value.trim()
    };

    if (
        !email.from ||
        !email.subject ||
        email.body.length < 3
    ) {
        showError(
            "Please provide an email address, subject, and message."
        );

        return;
    }

    if (email.body.length > 10000) {
        showError(
            "The email message cannot exceed 10,000 characters."
        );

        return;
    }

    resetDraftView();
    setLoading(true);

    try {
        const response = await fetch(
            `${API_BASE}/draft`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(email)
            }
        );

        const data = await readResponse(response);

        console.log("Email analysis response:", data);

        displayDraft(data);

        emailsProcessed += 1;

        elements.emailsProcessed.textContent =
            String(emailsProcessed);

        showSuccess(
            "AI draft generated successfully. Review it before approval."
        );

    } catch (error) {
        console.error("Email analysis failed:", error);

        showError(
            error instanceof Error
                ? error.message
                : "Unable to analyze the email."
        );

        elements.categoryOutput.textContent = "Analysis failed";
        elements.reviewStatus.textContent = "Error";
        elements.dashboardStatus.textContent = "Error";

        elements.dashboardStatusDetail.textContent =
            "Check the error message";

        elements.knowledgeStatus.textContent =
            "Analysis failed";

    } finally {
        setLoading(false);
    }
}

// Save an edited draft using PUT /api/emails/:id.
async function saveEditedDraft() {
    clearMessages();

    if (!currentDraftId) {
        showError(
            "Generate an email draft before saving."
        );

        return;
    }

    if (
        currentDraftStatus !== "awaiting_human_review"
    ) {
        showError(
            "Only drafts awaiting human review can be edited."
        );

        return;
    }

    const editedDraft = elements.draftOutput.value.trim();

    if (!editedDraft) {
        showError("The reply draft cannot be empty.");
        return;
    }

    if (editedDraft.length > 15000) {
        showError(
            "The reply draft cannot exceed 15,000 characters."
        );

        return;
    }

    if (!elements.saveDraftButton) {
        showError(
            'Save button not found. Add id="saveDraftButton" to the HTML button.'
        );

        return;
    }

    elements.saveDraftButton.disabled = true;

    const previousButtonText =
        elements.saveDraftButton.textContent;

    elements.saveDraftButton.textContent = "Saving...";

    try {
        const response = await fetch(
            `${API_BASE}/${encodeURIComponent(currentDraftId)}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    draft: editedDraft
                })
            }
        );

        const data = await readResponse(response);

        // Update the frontend with the saved draft.
        originalDraft = data.draft || editedDraft;

        elements.draftOutput.value = originalDraft;

        currentDraftStatus =
            data.status || currentDraftStatus;

        elements.reviewStatus.textContent =
            currentDraftStatus.replaceAll("_", " ");

        elements.dashboardStatus.textContent =
            currentDraftStatus === "awaiting_human_review"
                ? "Review"
                : currentDraftStatus;

        elements.dashboardStatusDetail.textContent =
            "Edited draft saved; awaiting human approval";

        elements.draftMode.textContent =
            "Edited draft saved";

        elements.knowledgeStatus.textContent =
            "Draft saved";

        showSuccess(
            data.message || "Edited draft saved successfully."
        );

    } catch (error) {
        console.error("Saving edited draft failed:", error);

        showError(
            error instanceof Error
                ? error.message
                : "Unable to save the edited draft."
        );

    } finally {
        elements.saveDraftButton.disabled = false;

        elements.saveDraftButton.textContent =
            previousButtonText || "Save Edited Draft";
    }
}

// Approve the current draft.
// This records approval; it does not send an email.
async function approveDraft() {
    clearMessages();

    if (!currentDraftId) {
        showError(
            "Generate a draft before approving it."
        );

        return;
    }

    if (
        currentDraftStatus !== "awaiting_human_review"
    ) {
        showError(
            "This draft has already been reviewed."
        );

        return;
    }

    const editedDraft =
        elements.draftOutput.value.trim();

    if (!editedDraft) {
        showError(
            "The reply draft cannot be empty."
        );

        return;
    }

    if (editedDraft !== originalDraft) {
        showError(
            "You changed the draft. Click Save Edited Draft before approving it."
        );

        return;
    }

    elements.approveButton.disabled = true;
    elements.rejectButton.disabled = true;

    try {
        const response = await fetch(
            `${API_BASE}/${encodeURIComponent(currentDraftId)}/approve`,
            {
                method: "POST",
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        const data = await readResponse(response);

        currentDraftStatus =
            data.status || "approved";

        elements.reviewStatus.textContent =
            currentDraftStatus.replaceAll("_", " ");

        elements.dashboardStatus.textContent =
            "Approved";

        elements.dashboardStatusDetail.textContent =
            "Approval recorded; email not sent";

        elements.draftMode.textContent =
            "Approved";

        elements.knowledgeStatus.textContent =
            "Draft approved";

        showSuccess(
            "Draft approved successfully. No email was sent."
        );

    } catch (error) {
        console.error("Approval failed:", error);

        showError(
            error instanceof Error
                ? error.message
                : "Unable to approve the draft."
        );

        elements.approveButton.disabled = false;
        elements.rejectButton.disabled = false;
    }
}

// Reject the current draft.
async function rejectDraft() {
    clearMessages();

    if (!currentDraftId) {
        showError(
            "Generate a draft before rejecting it."
        );

        return;
    }

    if (
        currentDraftStatus !== "awaiting_human_review"
    ) {
        showError(
            "This draft has already been reviewed."
        );

        return;
    }

    elements.approveButton.disabled = true;
    elements.rejectButton.disabled = true;

    try {
        const response = await fetch(
            `${API_BASE}/${encodeURIComponent(currentDraftId)}/reject`,
            {
                method: "POST",
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        const data = await readResponse(response);

        currentDraftStatus =
            data.status || "rejected";

        elements.reviewStatus.textContent =
            currentDraftStatus.replaceAll("_", " ");

        elements.dashboardStatus.textContent =
            "Rejected";

        elements.dashboardStatusDetail.textContent =
            "Draft rejected";

        elements.draftMode.textContent =
            "Rejected";

        elements.knowledgeStatus.textContent =
            "Draft rejected";

        showSuccess(
            "Draft rejected successfully."
        );

    } catch (error) {
        console.error("Rejection failed:", error);

        showError(
            error instanceof Error
                ? error.message
                : "Unable to reject the draft."
        );

        elements.approveButton.disabled = false;
        elements.rejectButton.disabled = false;
    }
}

// Copy the draft to the clipboard.
async function copyDraft() {
    clearMessages();

    const text =
        elements.draftOutput.value.trim();

    if (!text) {
        showError(
            "There is no draft to copy."
        );

        return;
    }

    try {
        await navigator.clipboard.writeText(text);

        showSuccess(
            "Draft copied to clipboard."
        );

    } catch (error) {
        console.error(
            "Clipboard operation failed:",
            error
        );

        elements.draftOutput.focus();
        elements.draftOutput.select();

        showError(
            "Automatic copying failed. Press Ctrl+C to copy the selected text."
        );
    }
}

// Sample email data.
const samples = {
    billing: {
        from: "customer@example.com",
        subject: "Question about my invoice",
        body: "Hello Support Team,\n\nI have a question about the invoice for my account. Could you please explain the billing details and tell me how I can verify the payment?\n\nThank you."
    },

    account: {
        from: "customer@example.com",
        subject: "Unable to sign in to my account",
        body: "Hello Support Team,\n\nI am unable to sign in to my account. I have tried again, but I still cannot access it. Could you please guide me through the account recovery process?\n\nThank you."
    },

    domain: {
        from: "customer@example.com",
        subject: "My domain is not connecting",
        body: "Hello Support Team,\n\nI connected my domain to my website, but my website is still not opening. Could you please help me identify the problem and explain how to fix it?\n\nThank you."
    }
};

// Fill the email form with sample data.
function loadSample(name) {
    const sample = samples[name];

    if (!sample) {
        return;
    }

    elements.from.value = sample.from;
    elements.subject.value = sample.subject;
    elements.body.value = sample.body;

    updateCharacterCount();
    clearMessages();

    elements.body.focus();
}

// Update the email character count.
function updateCharacterCount() {
    elements.characterCount.textContent =
        `${elements.body.value.length} / 10000`;
}

// Check the backend connection.
async function checkBackend() {
    try {
        const response = await fetch(
            "/health",
            {
                headers: {
                    "Accept": "application/json"
                }
            }
        );

        const data = await readResponse(response);

        console.log("Backend connected:", data);

        elements.knowledgeStatus.textContent =
            "Backend connected; awaiting analysis";

    } catch (error) {
        console.error(
            "Backend health check failed:",
            error
        );

        elements.knowledgeStatus.textContent =
            "Backend connection failed";

        showError(
            "Cannot connect to the backend. Make sure the Task 2 server is running."
        );
    }
}

// Register event listeners.
function initializeApp() {
    console.log(
        "AI Inbox Agent frontend loaded."
    );

    elements.form.addEventListener(
        "submit",
        analyzeEmail
    );

    elements.approveButton.addEventListener(
        "click",
        approveDraft
    );

    elements.rejectButton.addEventListener(
        "click",
        rejectDraft
    );

    elements.copyButton.addEventListener(
        "click",
        copyDraft
    );

    if (elements.saveDraftButton) {
        elements.saveDraftButton.addEventListener(
            "click",
            saveEditedDraft
        );
    }

    // Sample email buttons.
    document.querySelectorAll("[data-sample]").forEach(
        (button) => {
            button.addEventListener("click", () => {
                loadSample(button.dataset.sample);
            });
        }
    );

    // Email message character counter.
    elements.body.addEventListener(
        "input",
        updateCharacterCount
    );

    // Notify the user when the draft has unsaved edits.
    if (
        elements.draftOutput &&
        elements.saveDraftButton
    ) {
        elements.draftOutput.addEventListener(
            "input",
            () => {
                if (
                    currentDraftId &&
                    currentDraftStatus === "awaiting_human_review" &&
                    elements.draftOutput.value.trim() !== originalDraft
                ) {
                    elements.draftMode.textContent =
                        "Unsaved edits";

                    elements.saveDraftButton.disabled = false;
                }
            }
        );
    }

    updateCharacterCount();
    checkBackend();
}

// Initialize after the page loads.
document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);