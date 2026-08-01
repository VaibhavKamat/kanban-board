from types import SimpleNamespace
from unittest.mock import MagicMock

import chat as chat_module


def _fake_client(parsed_output):
    fake_response = SimpleNamespace(parsed_output=parsed_output)
    fake_client = MagicMock()
    fake_client.messages.parse.return_value = fake_response
    return fake_client


def test_chat_requires_auth(client):
    assert client.post("/api/chat", json={"message": "hi"}).status_code == 401


def test_chat_no_board_change(auth_client, monkeypatch):
    parsed = chat_module.ChatResponse(reply="Hi there!", board_update=None)
    monkeypatch.setattr(chat_module, "get_client", lambda: _fake_client(parsed))

    response = auth_client.post("/api/chat", json={"message": "hello"})

    assert response.status_code == 200
    data = response.json()
    assert data["reply"] == "Hi there!"
    assert data["board"]["cards"] == []


def test_chat_creates_a_card(auth_client, monkeypatch):
    board_before = auth_client.get("/api/board").json()
    todo_id = next(c["id"] for c in board_before["columns"] if c["key"] == "todo")

    parsed = chat_module.ChatResponse(
        reply="Added a card to To Do.",
        board_update=chat_module.BoardUpdate(
            cards=[
                chat_module.CardUpdate(
                    id=None, column_key="todo", title="New task", description="via chat"
                )
            ]
        ),
    )
    monkeypatch.setattr(chat_module, "get_client", lambda: _fake_client(parsed))

    response = auth_client.post("/api/chat", json={"message": "add a card to to do"})

    assert response.status_code == 200
    cards = response.json()["board"]["cards"]
    assert any(c["title"] == "New task" and c["columnId"] == todo_id for c in cards)


def test_chat_moves_a_card(auth_client, monkeypatch):
    board_before = auth_client.get("/api/board").json()
    todo_id = next(c["id"] for c in board_before["columns"] if c["key"] == "todo")
    done_id = next(c["id"] for c in board_before["columns"] if c["key"] == "done")
    created = auth_client.post(
        "/api/cards", json={"column_id": todo_id, "title": "Move me"}
    ).json()
    card_id = created["cards"][0]["id"]

    parsed = chat_module.ChatResponse(
        reply="Moved it to Done.",
        board_update=chat_module.BoardUpdate(
            cards=[chat_module.CardUpdate(id=card_id, column_key="done", title="Move me")]
        ),
    )
    monkeypatch.setattr(chat_module, "get_client", lambda: _fake_client(parsed))

    response = auth_client.post("/api/chat", json={"message": "move it to done"})

    assert response.status_code == 200
    moved = next(c for c in response.json()["board"]["cards"] if c["id"] == card_id)
    assert moved["columnId"] == done_id


def test_chat_renames_a_column(auth_client, monkeypatch):
    parsed = chat_module.ChatResponse(
        reply="Renamed Backlog to Icebox.",
        board_update=chat_module.BoardUpdate(
            columns=[chat_module.ColumnUpdate(key="backlog", name="Icebox")]
        ),
    )
    monkeypatch.setattr(chat_module, "get_client", lambda: _fake_client(parsed))

    response = auth_client.post("/api/chat", json={"message": "rename backlog to icebox"})

    assert response.status_code == 200
    renamed = next(c for c in response.json()["board"]["columns"] if c["key"] == "backlog")
    assert renamed["name"] == "Icebox"


def test_chat_multi_card_update_in_one_turn(auth_client, monkeypatch):
    board_before = auth_client.get("/api/board").json()
    todo_id = next(c["id"] for c in board_before["columns"] if c["key"] == "todo")

    parsed = chat_module.ChatResponse(
        reply="Added two cards.",
        board_update=chat_module.BoardUpdate(
            cards=[
                chat_module.CardUpdate(id=None, column_key="todo", title="Task A"),
                chat_module.CardUpdate(id=None, column_key="todo", title="Task B"),
            ]
        ),
    )
    monkeypatch.setattr(chat_module, "get_client", lambda: _fake_client(parsed))

    response = auth_client.post("/api/chat", json={"message": "add task A and task B"})

    titles = {c["title"] for c in response.json()["board"]["cards"] if c["columnId"] == todo_id}
    assert {"Task A", "Task B"}.issubset(titles)


def test_chat_ignores_unresolvable_card_reference(auth_client, monkeypatch):
    # Simulates the model hallucinating a card id that doesn't exist -
    # should not crash the request, per "malformed AI output handled gracefully".
    parsed = chat_module.ChatResponse(
        reply="Done.",
        board_update=chat_module.BoardUpdate(
            cards=[chat_module.CardUpdate(id="9999", column_key="done", title="Ghost card")]
        ),
    )
    monkeypatch.setattr(chat_module, "get_client", lambda: _fake_client(parsed))

    response = auth_client.post("/api/chat", json={"message": "move the ghost card"})

    assert response.status_code == 200
    assert response.json()["reply"] == "Done."


def test_chat_handles_none_parsed_output_gracefully(auth_client, monkeypatch):
    # Simulates a refusal or unparseable response (response.parsed_output is None).
    monkeypatch.setattr(chat_module, "get_client", lambda: _fake_client(None))

    response = auth_client.post("/api/chat", json={"message": "hello"})

    assert response.status_code == 200
    assert "reply" in response.json()


def test_chat_persists_and_sends_history_on_next_request(auth_client, monkeypatch):
    parsed1 = chat_module.ChatResponse(reply="Sure, noted.", board_update=None)
    monkeypatch.setattr(chat_module, "get_client", lambda: _fake_client(parsed1))
    auth_client.post("/api/chat", json={"message": "remember I like pizza"})

    captured = {}

    def capture_client():
        def fake_parse(**kwargs):
            captured["messages"] = kwargs["messages"]
            return SimpleNamespace(
                parsed_output=chat_module.ChatResponse(
                    reply="You like pizza.", board_update=None
                )
            )

        fake_client = MagicMock()
        fake_client.messages.parse.side_effect = fake_parse
        return fake_client

    monkeypatch.setattr(chat_module, "get_client", capture_client)
    response = auth_client.post("/api/chat", json={"message": "what do I like?"})

    assert response.status_code == 200
    history_texts = [m["content"] for m in captured["messages"]]
    assert any("pizza" in t for t in history_texts)
