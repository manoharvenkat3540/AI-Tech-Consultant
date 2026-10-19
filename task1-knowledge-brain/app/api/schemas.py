from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    question: str = Field(
        min_length=1,
        max_length=4000,
        description="The question asked by the user",
    )


class Source(BaseModel):
    title: str
    url: str


class ChatResponse(BaseModel):
    question: str
    answer: str
    sources: list[Source] = Field(default_factory=list)
    needs_human_review: bool = False