import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_login_success_sets_cookie(client):
    response = client.post("/api/login", json={"username": "user", "password": "password"})
    assert response.status_code == 200
    assert response.json() == {"username": "user"}
    assert "session_id" in response.cookies


def test_login_failure_returns_401(client):
    response = client.post("/api/login", json={"username": "user", "password": "wrong"})
    assert response.status_code == 401
    assert "session_id" not in response.cookies


def test_me_unauthenticated_without_cookie(client):
    response = client.get("/api/me")
    assert response.status_code == 200
    assert response.json() == {"authenticated": False, "username": None}


def test_me_authenticated_after_login(client):
    client.post("/api/login", json={"username": "user", "password": "password"})
    response = client.get("/api/me")
    assert response.status_code == 200
    assert response.json() == {"authenticated": True, "username": "user"}


def test_logout_clears_session(client):
    client.post("/api/login", json={"username": "user", "password": "password"})
    logout_response = client.post("/api/logout")
    assert logout_response.status_code == 200

    me_response = client.get("/api/me")
    assert me_response.json() == {"authenticated": False, "username": None}
