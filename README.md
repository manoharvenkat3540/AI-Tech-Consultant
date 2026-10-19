# AI Tech Consultant

An AI-powered consulting project designed to support knowledge retrieval,
email assistance, and meeting-to-statement-of-work generation.

## Project Tasks

### Task 1: Knowledge Brain
A Python-based knowledge retrieval API that collects support articles,
stores them in SQLite, retrieves relevant information, and generates
context-aware answers using an LLM.

**Technologies:** Python, FastAPI, SQLite, BeautifulSoup, Groq API.

### Task 2: Inbox Agent
An AI-assisted inbox workflow designed to analyze email content and
help generate contextual email drafts.

**Technologies:** TypeScript, Node.js, LLM API.

### Task 3: Meeting-to-SOW
A workflow designed to transform meeting information into a structured
Statement of Work (SOW).

**Technologies:** Python and LLM integration.

## Repository Structure

```text
AI-Tech-Consultant/
├── task1-knowledge-brain/
├── task2-inbox-agent/
├── task3-meeting-to-sow/
├── docs/
│   ├── README.md
│   ├── DESIGN.md
│   ├── EVALS.md
│   └── AI_LOG.md
├── scripts/
└── package.json