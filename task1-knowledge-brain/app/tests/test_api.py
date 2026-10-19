from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_ask_endpoint_validates_short_question():
    response = client.post(
        "/api/ask",
        json={"question": "Hi"}
    )

    assert response.status_code == 422


def test_ask_endpoint_rejects_empty_question():
    response = client.post(
        "/api/ask",
        json={"question": ""}
    )

    assert response.status_code == 422