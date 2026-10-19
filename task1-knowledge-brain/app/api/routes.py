from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.knowledge_service import answer_question

router = APIRouter()


class QuestionRequest(BaseModel):
    question: str = Field(
        ...,
        min_length=3,
        max_length=2000,
        description="Your Brilliant Directories support question",
    )


@router.post("/ask")
def ask_question(request: QuestionRequest):
    try:
        result = answer_question(request.question)

        return {
            "question": request.question,
            "answer": result["answer"],
            "sources": result.get("sources", []),
            "needs_human": result.get("needs_human", False),
        }

    except Exception as exc:
        print(f"Question processing failed: {type(exc).__name__}")

        raise HTTPException(
            status_code=500,
            detail="Unable to process your question. Please try again.",
        )