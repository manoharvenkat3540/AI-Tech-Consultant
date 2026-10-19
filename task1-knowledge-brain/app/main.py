from fastapi import FastAPI
from app.api.routes import router

app = FastAPI(
    title="AI Tech Consultant - Knowledge Brain",
    description="AI-powered support knowledge assistant",
    version="1.0.0",
)

app.include_router(
    router,
    prefix="/api",
    tags=["Knowledge Brain"],
)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Knowledge Brain API",
    }