from types import SimpleNamespace
from unittest.mock import MagicMock

import chat as chat_module


def _fake_client(parsed_output):
    fake_response = SimpleNamespace(parsed_output=parsed_output)
    fake_client = MagicMock()
    fake_client.messages.parse.return_value = fake_response
    return fake_client


def test_create_project_requires_auth(client):
    assert client.post("/api/projects", json={"name": "project1"}).status_code == 401


def test_create_project_succeeds_for_demo_user(auth_client):
    response = auth_client.post("/api/projects", json={"name": "project1"})
    assert response.status_code == 200
    assert response.json() == {"id": response.json()["id"], "type": "project", "name": "project1"}


def test_create_project_forbidden_for_signed_up_user(client):
    client.post(
        "/api/signup",
        json={"username": "alice", "email": "alice@example.com", "password": "correcthorse"},
    )
    client.post("/api/login", json={"username": "alice", "password": "correcthorse"})

    response = client.post("/api/projects", json={"name": "project1"})
    assert response.status_code == 403


def test_create_project_duplicate_name_returns_409(auth_client):
    auth_client.post("/api/projects", json={"name": "project1"})
    response = auth_client.post("/api/projects", json={"name": "project1"})
    assert response.status_code == 409


def test_project_listed_for_every_user(client):
    client.post("/api/login", json={"username": "user", "password": "password"})
    client.post("/api/projects", json={"name": "project1"})
    client.post("/api/logout")

    client.post(
        "/api/signup",
        json={"username": "alice", "email": "alice@example.com", "password": "correcthorse"},
    )
    client.post("/api/login", json={"username": "alice", "password": "correcthorse"})

    boards = client.get("/api/boards").json()["boards"]
    assert "project1" in [b["name"] for b in boards]


def test_chat_with_board_id_mutates_project_not_personal_board(auth_client, monkeypatch):
    project = auth_client.post("/api/projects", json={"name": "project1"}).json()
    project_id = project["id"]

    parsed = chat_module.ChatResponse(
        reply="Added it.",
        board_update=chat_module.BoardUpdate(
            cards=[chat_module.CardUpdate(column_key="todo", title="From chat")]
        ),
    )
    monkeypatch.setattr(chat_module, "get_client", lambda: _fake_client(parsed))

    response = auth_client.post(
        "/api/chat", json={"message": "add a card", "board_id": project_id}
    )
    assert response.status_code == 200
    assert response.json()["board"]["cards"][0]["title"] == "From chat"

    project_board = auth_client.get(f"/api/board?board_id={project_id}").json()
    assert [c["title"] for c in project_board["cards"]] == ["From chat"]

    personal_board = auth_client.get("/api/board").json()
    assert personal_board["cards"] == []
