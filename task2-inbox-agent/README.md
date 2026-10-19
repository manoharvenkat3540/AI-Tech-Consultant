\# AI Inbox Agent



An AI-powered email assistant that analyzes customer emails, identifies their categories, retrieves relevant information from a Knowledge Brain, and generates context-aware email drafts for human review.



\## Features



\- AI-powered email analysis

\- Automatic email category detection

\- Knowledge Brain document retrieval

\- Context-aware email response generation using Groq

\- Editable AI-generated drafts

\- Save, approve, and reject draft workflows

\- Human review before approval

\- REST API built with Express and TypeScript

\- Automated testing with Vitest



\## Technology Stack



\- TypeScript

\- Node.js

\- Express.js

\- Groq API

\- Zod

\- Vitest

\- HTML, CSS, and JavaScript



\## Project Structure



```text

task2-inbox-agent/

├── public/

│   ├── index.html

│   ├── style.css

│   └── script.js

├── src/

│   ├── email.ts

│   ├── index.ts

│   └── knowledge.ts

├── tests/

│   └── knowledge.test.ts

├── .env.example

├── package.json

└── README.md

```



\## Prerequisites



\- Node.js

\- npm

\- Groq API key



\## Installation



Clone the repository:



```bash

git clone https://github.com/manoharvenkat3540/AI-Tech-Consultant.git

cd AI-Tech-Consultant/task2-inbox-agent

```



Install dependencies:



```bash

npm install

```



Create a local `.env` file with your configuration:



```env

PORT=3000

GROQ\_API\_KEY=your\_groq\_api\_key

GROQ\_MODEL=openai/gpt-oss-20b

```



Replace the example API key with your own. Never share your API key or commit your `.env` file to GitHub.



\## Run the Application



Start the development server:



```bash

npm run dev

```



Open the dashboard:



http://localhost:3000



Check the backend health endpoint:



http://localhost:3000/health



\## API Endpoints



| Method | Endpoint | Description |

|---|---|---|

| GET | `/health` | Check backend health |

| POST | `/api/emails/draft` | Analyze an email and generate a draft |

| GET | `/api/emails/:id` | Retrieve a draft |

| PUT | `/api/emails/:id` | Update a draft |

| POST | `/api/emails/:id/approve` | Approve a draft |

| POST | `/api/emails/:id/reject` | Reject a draft |



\*\*Note:\*\* Approval records a human decision but does not send an actual email. Drafts are stored in memory and are lost when the server restarts.



\## Run Tests



Execute the automated tests:



```bash

npm test

```



The Knowledge Brain test suite currently passes all 9 automated tests.



\## Workflow



1\. Enter the customer's email address, subject, and message.

2\. Submit the email for AI analysis.

3\. Detect the email category.

4\. Retrieve relevant knowledge documents.

5\. Generate a context-aware email response.

6\. Review and edit the generated draft.

7\. Save, approve, or reject the draft.



\## Project Objective



This project demonstrates how Large Language Models, knowledge retrieval, API integration, and human-in-the-loop review can be combined to build an AI-powered email assistant.



\## Author



Manohar Venkat

