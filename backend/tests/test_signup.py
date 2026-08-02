def test_signup_success_does_not_create_session(client):
    response = client.post(
        "/api/signup",
        json={"username": "alice", "email": "alice@example.com", "password": "correcthorse"},
    )
    assert response.status_code == 200
    assert response.json() == {"username": "alice"}
    assert "session_id" not in response.cookies

    me = client.get("/api/me")
    assert me.json() == {"authenticated": False, "username": None}


def test_new_user_can_log_in_and_gets_own_empty_board(client):
    client.post(
        "/api/signup",
        json={"username": "alice", "email": "alice@example.com", "password": "correcthorse"},
    )
    login = client.post("/api/login", json={"username": "alice", "password": "correcthorse"})
    assert login.status_code == 200

    response = client.get("/api/board")
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


def test_signup_boards_are_isolated_between_users(client):
    client.post(
        "/api/signup",
        json={"username": "alice", "email": "alice@example.com", "password": "correcthorse"},
    )
    client.post("/api/login", json={"username": "alice", "password": "correcthorse"})
    client.post("/api/cards", json={"column_id": "1", "title": "Alice's card"})
    client.post("/api/logout")

    client.post(
        "/api/signup",
        json={"username": "bob", "email": "bob@example.com", "password": "correcthorse"},
    )
    client.post("/api/login", json={"username": "bob", "password": "correcthorse"})
    board = client.get("/api/board").json()
    assert board["cards"] == []


def test_signup_duplicate_username_returns_409(client):
    client.post(
        "/api/signup",
        json={"username": "alice", "email": "alice@example.com", "password": "correcthorse"},
    )

    response = client.post(
        "/api/signup",
        json={"username": "alice", "email": "different@example.com", "password": "correcthorse"},
    )
    assert response.status_code == 409


def test_signup_duplicate_email_returns_409(client):
    client.post(
        "/api/signup",
        json={"username": "alice", "email": "alice@example.com", "password": "correcthorse"},
    )

    response = client.post(
        "/api/signup",
        json={"username": "different", "email": "alice@example.com", "password": "correcthorse"},
    )
    assert response.status_code == 409


def test_signup_short_password_returns_422(client):
    response = client.post(
        "/api/signup",
        json={"username": "alice", "email": "alice@example.com", "password": "short"},
    )
    assert response.status_code == 422


def test_signup_invalid_email_returns_422(client):
    response = client.post(
        "/api/signup",
        json={"username": "alice", "email": "not-an-email", "password": "correcthorse"},
    )
    assert response.status_code == 422


def test_hardcoded_demo_login_still_works_after_signup_feature(client):
    response = client.post("/api/login", json={"username": "user", "password": "password"})
    assert response.status_code == 200
