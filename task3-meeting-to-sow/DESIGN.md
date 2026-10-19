# System Design — AI Tech Consultant

## 1. Overview

The Meeting-to-SOW Agent analyzes client meeting transcripts,
extracts project requirements, generates a draft Statement of Work
(SOW), and evaluates follow-up meetings for scope changes.

The service is implemented in Python using FastAPI.

## 2. Architecture

The application contains these main components:

1. **FastAPI API layer**
   - Exposes HTTP endpoints for meeting analysis, proposal retrieval,
     proposal decisions, and follow-up analysis.

2. **Meeting analysis**
   - Processes the meeting transcript.
   - Extracts requirements, deliverables, scope, assumptions, and risks.
   - Produces a preliminary effort estimate and draft SOW.

3. **Knowledge integration**
   - Uses the configured Task 1 Knowledge Brain API to retrieve
     potentially relevant knowledge sources.
   - Includes returned sources in the meeting analysis when available.

4. **Proposal storage**
   - Persists generated proposals and their statuses.
   - Stores scope-change analysis associated with proposals.

5. **Follow-up analysis**
   - Compares new requests against the proposal's recorded scope.
   - Identifies potentially out-of-scope requests.
   - Recommends next steps and flags changes for human review.

6. **Human approval**
   - Records proposal approval or rejection.
   - Does not automatically send a proposal to a client.

## 3. Request Flow

### Initial meeting

1. A user submits a client name, project name, and meeting transcript.
2. The API processes the meeting information.
3. The configured language model generates a structured analysis.
4. The application retrieves relevant knowledge sources when available.
5. The generated proposal is saved.
6. The API returns the proposal ID and draft SOW for review.

### Follow-up meeting

1. A user submits the proposal ID and follow-up transcript.
2. The application retrieves the original proposal.
3. The agent analyzes requested changes against the recorded scope.
4. Potentially out-of-scope items and impacts are identified.
5. The scope-change record is saved.
6. The API returns the analysis and requests human review.

### Proposal decision

1. A reviewer submits an approval or rejection decision.
2. The application updates the proposal status.
3. The decision is persisted.
4. No external client email is sent by this endpoint.

## 4. API Endpoints

- `GET /health`
- `POST /api/meetings/analyze`
- `GET /api/proposals`
- `GET /api/proposals/{proposal_id}`
- `POST /api/proposals/{proposal_id}/decision`
- `POST /api/meetings/follow-up`
- `GET /api/proposals/{proposal_id}/scope-changes`

## 5. Safety and Human Review

Generated requirements, effort estimates, and SOW documents are
drafts. A human must review the proposal before it is finalized.

Potential scope changes should be reviewed before additional work
is authorized.

## 6. Current Limitations

- Effort estimates are preliminary and require expert validation.
- Knowledge retrieval depends on the Task 1 service being available.
- Model-generated results may be incomplete or incorrect.
- Additional integration tests and model evaluations are required.
- The actual language model provider must be verified against the
  final assignment requirement.

## 7. Testing

The current automated suite contains six tests covering:

- Health endpoint
- Proposal listing
- Existing proposal retrieval
- Nonexistent proposal handling
- Invalid proposal decision
- Missing meeting transcript validation

All six tests passed in the development environment.