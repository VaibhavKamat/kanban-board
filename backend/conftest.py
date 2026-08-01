import pytest
from fastapi.testclient import TestClient

import db


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    from main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_client(client):
    client.post("/api/login", json={"username": "user", "password": "password"})
    return client
