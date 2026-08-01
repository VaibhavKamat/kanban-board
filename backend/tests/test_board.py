def test_get_board_returns_seeded_columns_no_cards(auth_client):
    response = auth_client.get("/api/board")
    assert response.status_code == 200
    data = response.json()
    assert [c["name"] for c in data["columns"]] == [
        "Backlog",
        "To Do",
        "In Progress",
        "Review",
        "Done",
    ]
    assert data["cards"] == []


def test_get_board_requires_auth(client):
    assert client.get("/api/board").status_code == 401


def test_rename_column(auth_client):
    board = auth_client.get("/api/board").json()
    backlog_id = next(c["id"] for c in board["columns"] if c["key"] == "backlog")

    response = auth_client.patch(f"/api/columns/{backlog_id}", json={"name": "Icebox"})
    assert response.status_code == 200
    renamed = next(c for c in response.json()["columns"] if c["id"] == backlog_id)
    assert renamed["name"] == "Icebox"
    assert renamed["key"] == "backlog"


def test_rename_nonexistent_column_404(auth_client):
    assert auth_client.patch("/api/columns/9999", json={"name": "X"}).status_code == 404


def test_create_card(auth_client):
    board = auth_client.get("/api/board").json()
    todo_id = next(c["id"] for c in board["columns"] if c["key"] == "todo")

    response = auth_client.post(
        "/api/cards", json={"column_id": todo_id, "title": "New task", "description": "desc"}
    )
    assert response.status_code == 200
    cards = response.json()["cards"]
    assert len(cards) == 1
    assert cards[0]["title"] == "New task"
    assert cards[0]["columnId"] == todo_id
    assert cards[0]["order"] == 0


def test_create_card_invalid_column_404(auth_client):
    response = auth_client.post("/api/cards", json={"column_id": "9999", "title": "X"})
    assert response.status_code == 404


def test_update_card_edits_fields(auth_client):
    board = auth_client.get("/api/board").json()
    todo_id = next(c["id"] for c in board["columns"] if c["key"] == "todo")
    created = auth_client.post(
        "/api/cards", json={"column_id": todo_id, "title": "Task", "description": "d"}
    ).json()
    card_id = created["cards"][0]["id"]

    response = auth_client.patch(
        f"/api/cards/{card_id}", json={"title": "Updated", "description": "new desc"}
    )
    assert response.status_code == 200
    card = next(c for c in response.json()["cards"] if c["id"] == card_id)
    assert card["title"] == "Updated"
    assert card["description"] == "new desc"


def test_update_card_not_found_404(auth_client):
    assert auth_client.patch("/api/cards/9999", json={"title": "X"}).status_code == 404


def test_move_card_within_column_reorders(auth_client):
    board = auth_client.get("/api/board").json()
    todo_id = next(c["id"] for c in board["columns"] if c["key"] == "todo")

    r1 = auth_client.post("/api/cards", json={"column_id": todo_id, "title": "First"}).json()
    r2 = auth_client.post("/api/cards", json={"column_id": todo_id, "title": "Second"}).json()
    first_id = next(c["id"] for c in r1["cards"] if c["title"] == "First")
    second_id = next(c["id"] for c in r2["cards"] if c["title"] == "Second")

    response = auth_client.patch(
        f"/api/cards/{first_id}", json={"column_id": todo_id, "order": 1}
    )
    assert response.status_code == 200
    cards = sorted(
        (c for c in response.json()["cards"] if c["columnId"] == todo_id),
        key=lambda c: c["order"],
    )
    assert [c["id"] for c in cards] == [second_id, first_id]
    assert [c["order"] for c in cards] == [0, 1]


def test_move_card_across_columns_resequences_both(auth_client):
    board = auth_client.get("/api/board").json()
    todo_id = next(c["id"] for c in board["columns"] if c["key"] == "todo")
    in_progress_id = next(c["id"] for c in board["columns"] if c["key"] == "in_progress")

    r1 = auth_client.post("/api/cards", json={"column_id": todo_id, "title": "A"}).json()
    r2 = auth_client.post("/api/cards", json={"column_id": todo_id, "title": "B"}).json()
    a_id = next(c["id"] for c in r1["cards"] if c["title"] == "A")
    b_id = next(c["id"] for c in r2["cards"] if c["title"] == "B")

    response = auth_client.patch(
        f"/api/cards/{a_id}", json={"column_id": in_progress_id, "order": 0}
    )
    assert response.status_code == 200
    data = response.json()

    moved = next(c for c in data["cards"] if c["id"] == a_id)
    assert moved["columnId"] == in_progress_id
    assert moved["order"] == 0

    remaining_todo = [c for c in data["cards"] if c["columnId"] == todo_id]
    assert [c["id"] for c in remaining_todo] == [b_id]
    assert remaining_todo[0]["order"] == 0


def test_move_card_to_nonexistent_column_404(auth_client):
    board = auth_client.get("/api/board").json()
    todo_id = next(c["id"] for c in board["columns"] if c["key"] == "todo")
    created = auth_client.post("/api/cards", json={"column_id": todo_id, "title": "A"}).json()
    card_id = created["cards"][0]["id"]

    response = auth_client.patch(f"/api/cards/{card_id}", json={"column_id": "9999"})
    assert response.status_code == 404


def test_delete_card_resequences_remaining(auth_client):
    board = auth_client.get("/api/board").json()
    todo_id = next(c["id"] for c in board["columns"] if c["key"] == "todo")

    r1 = auth_client.post("/api/cards", json={"column_id": todo_id, "title": "A"}).json()
    r2 = auth_client.post("/api/cards", json={"column_id": todo_id, "title": "B"}).json()
    a_id = next(c["id"] for c in r1["cards"] if c["title"] == "A")
    b_id = next(c["id"] for c in r2["cards"] if c["title"] == "B")

    response = auth_client.delete(f"/api/cards/{a_id}")
    assert response.status_code == 200
    cards = response.json()["cards"]
    assert [c["id"] for c in cards] == [b_id]
    assert cards[0]["order"] == 0


def test_delete_card_not_found_404(auth_client):
    assert auth_client.delete("/api/cards/9999").status_code == 404


def test_card_and_column_routes_require_auth(client):
    assert client.post("/api/cards", json={"column_id": "1", "title": "X"}).status_code == 401
    assert client.patch("/api/cards/1", json={"title": "X"}).status_code == 401
    assert client.delete("/api/cards/1").status_code == 401
    assert client.patch("/api/columns/1", json={"name": "X"}).status_code == 401
