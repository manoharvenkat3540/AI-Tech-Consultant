# Evaluation Report — Task 3: Meeting-to-SOW Agent

## 1. Evaluation Objective

Evaluate whether the Meeting-to-SOW Agent can process meeting
requests, retrieve saved proposals, identify invalid inputs,
and maintain proposal decision status.

## 2. Automated Test Environment

- Framework: pytest
- API framework: FastAPI
- Test client: FastAPI TestClient
- Python environment: Project virtual environment
- Test file: `tests/test_main.py`

## 3. Automated Test Results

The following six automated tests passed during development.

| Test | Expected Result | Actual Result |
|---|---|---|
| Health endpoint | HTTP 200 and healthy status | Passed |
| List proposals | HTTP 200 and proposal list | Passed |
| Retrieve existing proposal | HTTP 200 and correct proposal | Passed |
| Retrieve nonexistent proposal | HTTP 404 | Passed |
| Invalid proposal decision | Invalid decision rejected | Passed |
| Missing meeting transcript | HTTP 422 | Passed |

**Result: 6 passed, 0 failed.**

These results represent the automated tests that were executed.
They do not establish that every assignment requirement has been met.

## 4. Manual Functional Tests

### Test A: Meeting analysis

A sample e-commerce website meeting transcript was submitted.

Observed results:
- Requirements were extracted.
- Deliverables were generated.
- In-scope and out-of-scope items were identified.
- Assumptions and risks were generated.
- A draft Statement of Work was returned.
- Knowledge source URLs were included in the response.
- Human approval was required.

Result: Passed for the tested example.

### Test B: Follow-up scope analysis

A follow-up meeting requested native Android and iOS applications
and push notifications, which were excluded from the original scope.

Observed results:
- The new requirements were identified.
- Potentially out-of-scope changes were listed.
- The impact on effort and timeline was described.
- Recommended next steps were returned.
- Human approval was required.
- A scope-change record was created.

Result: Passed for the tested example.

### Test C: Proposal rejection

A proposal rejection was submitted through the API.

Observed results:
- The API returned a rejection confirmation.
- A subsequent proposal listing showed the status as rejected.

Result: Passed for the tested example.

## 5. Known Evaluation Gaps

The following evaluations are still needed for a complete assessment:

- A larger set of varied meeting transcripts.
- Tests for ambiguous and contradictory requirements.
- Quantitative evaluation of effort estimates.
- Tests for Task 1 service outages and retrieval failures.
- Tests for repeated follow-up requests.
- Tests for scope changes that are actually in scope.
- Model output quality and consistency evaluation.
- Evaluation of three recorded or role-played meetings.
- Verification of all assignment-specific model evaluation requirements.

## 6. Limitations

Passing these tests demonstrates basic endpoint functionality and
the behavior observed in the listed examples. It does not prove
that model-generated requirements, estimates, or SOW documents
are always correct.

Human review remains necessary before approving project scope,
estimates, or contractual commitments.
