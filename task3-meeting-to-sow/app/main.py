import json
import os
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from groq import Groq
from pydantic import BaseModel, Field

from app import storage

load_dotenv()

app = FastAPI(
    title="AI Tech Consultant - Meeting-to-SOW Agent",
    description="Analyze meetings, generate draft SOWs, and track scope changes.",
    version="1.2.0",
)

API_KEY = os.getenv("GROQ_API_KEY")
MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
KNOWLEDGE_API_URL = os.getenv(
    "KNOWLEDGE_API_URL",
    "http://127.0.0.1:8000",
)

ai_client = Groq(api_key=API_KEY) if API_KEY else None


# --------------------------------------------------
# Request and response schemas
# --------------------------------------------------

class MeetingRequest(BaseModel):
    client_name: str = Field(min_length=1, max_length=150)
    project_name: str = Field(min_length=1, max_length=200)
    transcript: str = Field(min_length=50, max_length=50000)


class MeetingAnalysis(BaseModel):
    proposal_id: int | None = None
    client_name: str
    project_name: str
    requirements: list[str]
    deliverables: list[str]
    in_scope: list[str]
    out_of_scope: list[str]
    assumptions: list[str]
    risks: list[str]
    estimated_effort: str
    draft_sow: str
    knowledge_sources: list[dict[str, Any]]
    requires_human_approval: bool = True


class FollowUpRequest(BaseModel):
    proposal_id: int = Field(gt=0)

    # Retained for compatibility with existing API requests.
    # The stored proposal scope is used as the source of truth.
    original_scope: str = Field(min_length=10, max_length=20000)

    follow_up_transcript: str = Field(
        min_length=20,
        max_length=30000,
    )


class FollowUpAnalysis(BaseModel):
    scope_change_id: int | None = None
    proposal_id: int
    changes_requested: list[str]
    potentially_out_of_scope: list[str]
    impact_on_effort: str
    recommended_next_steps: list[str]
    requires_human_approval: bool = True


class ProposalDecision(BaseModel):
    decision: str = Field(pattern="^(approved|rejected)$")


# --------------------------------------------------
# Knowledge Brain integration
# --------------------------------------------------

def get_knowledge_sources(question: str) -> list[dict[str, Any]]:
    try:
        with httpx.Client(timeout=10.0) as http:
            response = http.post(
                f"{KNOWLEDGE_API_URL.rstrip('/')}/api/ask",
                json={"question": question},
            )
            response.raise_for_status()
            result = response.json()

        return result.get("sources", [])

    except (httpx.HTTPError, ValueError) as exc:
        print(f"Knowledge Brain unavailable: {exc}")
        return []


# --------------------------------------------------
# AI helper functions
# --------------------------------------------------

def generate_ai_response(
    system_prompt: str,
    user_prompt: str,
) -> str:

    if ai_client is None:
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY is missing from the Task 3 .env file.",
        )

    try:
        completion = ai_client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
        )

        content = completion.choices[0].message.content

        if not content:
            raise HTTPException(
                status_code=502,
                detail="The AI provider returned an empty response.",
            )

        return content

    except HTTPException:
        raise

    except Exception as exc:
        print(f"AI provider error: {exc}")

        raise HTTPException(
            status_code=502,
            detail=(
                "AI generation failed. Check the model name "
                "and API configuration."
            ),
        ) from exc


def parse_ai_json(raw_response: str) -> dict[str, Any]:
    text = raw_response.strip()

    if text.startswith("```"):
        lines = text.splitlines()

        if lines and lines[0].startswith("```"):
            lines = lines[1:]

        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]

        text = "\n".join(lines).strip()

    try:
        result = json.loads(text)

    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502,
            detail="The AI returned invalid JSON. Please retry.",
        ) from exc

    if not isinstance(result, dict):
        raise HTTPException(
            status_code=502,
            detail="The AI response must be a JSON object.",
        )

    return result


# --------------------------------------------------
# Health check
# --------------------------------------------------

@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": "Meeting-to-SOW Agent",
    }


# --------------------------------------------------
# Create and save a proposal
# --------------------------------------------------

@app.post(
    "/api/meetings/analyze",
    response_model=MeetingAnalysis,
)
def analyze_meeting(request: MeetingRequest) -> MeetingAnalysis:

    knowledge_sources = get_knowledge_sources(
        f"Project requirements for {request.project_name}. "
        f"Meeting transcript: {request.transcript[:4000]}"
    )

    system_prompt = """
You are a project consultant preparing a DRAFT Statement of Work.

Return one valid JSON object with exactly these fields:
requirements, deliverables, in_scope, out_of_scope, assumptions,
risks, estimated_effort, draft_sow.

The first six fields must be arrays of strings.
estimated_effort and draft_sow must be strings.

Use the meeting transcript as the source of client requirements.
Do not invent agreements, prices, deadlines, or approvals.
Identify unclear details as assumptions requiring confirmation.
Clearly distinguish included and excluded scope.
Provide a preliminary effort estimate with its assumptions.
Include objectives, scope, deliverables, assumptions, risks,
effort, and acceptance criteria in the draft SOW.
Clearly state that this is a draft requiring human approval.
Return JSON only, without Markdown fences.
"""

    user_prompt = f"""
CLIENT: {request.client_name}
PROJECT: {request.project_name}

MEETING TRANSCRIPT:
{request.transcript}

KNOWLEDGE BRAIN SOURCES:
{json.dumps(knowledge_sources, ensure_ascii=False)}

Use sources as background context, not as proof of client agreement.
"""

    result = parse_ai_json(
        generate_ai_response(system_prompt, user_prompt)
    )

    result["client_name"] = request.client_name
    result["project_name"] = request.project_name
    result["knowledge_sources"] = knowledge_sources
    result["requires_human_approval"] = True

    try:
        analysis = MeetingAnalysis.model_validate(result)

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="The AI response is missing required SOW fields.",
        ) from exc

    # Save the analysis to SQLite.
    proposal_id = storage.save_proposal(
        client_name=request.client_name,
        project_name=request.project_name,
        transcript=request.transcript,
        analysis=analysis.model_dump(exclude={"proposal_id"}),
    )

    # Return the generated database ID.
    response_data = analysis.model_dump()
    response_data["proposal_id"] = proposal_id

    return MeetingAnalysis.model_validate(response_data)


# --------------------------------------------------
# List saved proposals
# --------------------------------------------------

@app.get("/api/proposals")
def list_saved_proposals() -> dict[str, Any]:
    proposals = storage.list_proposals()

    return {
        "count": len(proposals),
        "proposals": proposals,
    }


# --------------------------------------------------
# Retrieve one proposal
# --------------------------------------------------

@app.get("/api/proposals/{proposal_id}")
def get_saved_proposal(proposal_id: int) -> dict[str, Any]:
    proposal = storage.get_proposal(proposal_id)

    if proposal is None:
        raise HTTPException(
            status_code=404,
            detail="Proposal not found.",
        )

    return proposal


# --------------------------------------------------
# Approve or reject a proposal
# --------------------------------------------------

@app.post("/api/proposals/{proposal_id}/decision")
def decide_proposal(
    proposal_id: int,
    request: ProposalDecision,
) -> dict[str, Any]:

    proposal = storage.get_proposal(proposal_id)

    if proposal is None:
        raise HTTPException(
            status_code=404,
            detail="Proposal not found.",
        )

    if proposal["status"] != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Proposal has already been {proposal['status']}.",
        )

    updated = storage.update_proposal_status(
        proposal_id,
        request.decision,
    )

    if not updated:
        raise HTTPException(
            status_code=409,
            detail="The proposal could not be updated. Please retry.",
        )

    return {
        "proposal_id": proposal_id,
        "status": request.decision,
        "message": (
            "Proposal approved."
            if request.decision == "approved"
            else "Proposal rejected."
        ),
        "note": (
            "This records an internal decision; "
            "it does not send anything to the client."
        ),
    }


# --------------------------------------------------
# Analyze and save a follow-up
# --------------------------------------------------

@app.post(
    "/api/meetings/follow-up",
    response_model=FollowUpAnalysis,
)
def analyze_follow_up(request: FollowUpRequest) -> FollowUpAnalysis:

    proposal = storage.get_proposal(request.proposal_id)

    if proposal is None:
        raise HTTPException(
            status_code=404,
            detail="Original proposal not found. Analyze a meeting first.",
        )

    # Use the saved proposal as the source of truth.
    original_analysis = proposal["analysis"]

    original_scope_items = original_analysis.get("in_scope", [])
    original_exclusions = original_analysis.get("out_of_scope", [])

    original_scope_text = (
        "Included scope:\n"
        + "\n".join(f"- {item}" for item in original_scope_items)
        + "\n\nExcluded scope:\n"
        + "\n".join(f"- {item}" for item in original_exclusions)
    )

    system_prompt = """
You are a project scope-change analyst.

Compare the original scope with the follow-up transcript.

Return valid JSON with exactly these fields:
changes_requested, potentially_out_of_scope, impact_on_effort,
recommended_next_steps.

The first, second, and fourth fields must be arrays of strings.
impact_on_effort must be a string.

Identify additions, removals, and changes.
Do not assume a requested change is approved.
Flag work outside the original scope.
Explain effort impact without inventing precise numbers.
Require human review before any scope change is accepted.
Return JSON only, without Markdown fences.
"""

    user_prompt = f"""
ORIGINAL SAVED PROPOSAL SCOPE:
{original_scope_text}

FOLLOW-UP TRANSCRIPT:
{request.follow_up_transcript}

Analyze the requested changes against the saved proposal scope.
"""

    result = parse_ai_json(
        generate_ai_response(system_prompt, user_prompt)
    )

    result["requires_human_approval"] = True
    result["proposal_id"] = request.proposal_id

    try:
        analysis = FollowUpAnalysis.model_validate(result)

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="The AI response is missing scope-change fields.",
        ) from exc

    try:
        scope_change_id = storage.save_scope_change(
            proposal_id=request.proposal_id,
            original_scope=original_scope_text,
            follow_up_transcript=request.follow_up_transcript,
            analysis=analysis.model_dump(exclude={"scope_change_id"}),
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc

    # Return the generated scope-change database ID.
    response_data = analysis.model_dump()
    response_data["scope_change_id"] = scope_change_id

    return FollowUpAnalysis.model_validate(response_data)


# --------------------------------------------------
# List scope changes
# --------------------------------------------------

@app.get("/api/proposals/{proposal_id}/scope-changes")
def list_scope_changes(proposal_id: int) -> dict[str, Any]:

    proposal = storage.get_proposal(proposal_id)

    if proposal is None:
        raise HTTPException(
            status_code=404,
            detail="Proposal not found.",
        )

    from app.storage import get_connection

    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, proposal_id, original_scope,
                   follow_up_transcript, status, created_at
            FROM scope_changes
            WHERE proposal_id = ?
            ORDER BY id DESC
            """,
            (proposal_id,),
        ).fetchall()

    return {
        "proposal_id": proposal_id,
        "count": len(rows),
        "scope_changes": [dict(row) for row in rows],
    }