# AI Tech Consultant — Task 3: Meeting-to-SOW Agent

## Overview

The Meeting-to-SOW Agent analyzes client meeting transcripts, extracts project requirements, generates a draft Statement of Work (SOW), and identifies potential scope changes during follow-up meetings.

Built using Python, FastAPI, Pydantic, SQLite, and a configured language model API.

## Features

- Meeting transcript analysis
- Requirements and deliverables extraction
- In-scope and out-of-scope identification
- Assumptions and risks analysis
- Preliminary effort estimation
- Draft Statement of Work generation
- Follow-up meeting analysis
- Scope-change recording
- Proposal approval and rejection workflow
- Persistent proposal storage
- Automated API tests

## Technologies

- Python
- FastAPI
- Pydantic
- Groq SDK
- SQLite
- pytest

## Setup

### 1. Activate the virtual environment

```powershell
.\.venv\Scripts\Activate.ps1