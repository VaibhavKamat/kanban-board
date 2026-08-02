import sqlite3

import db


def test_init_db_creates_file(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setattr(db, "DB_PATH", db_path)

    assert not db_path.exists()
    db.init_db()
    assert db_path.exists()


def test_init_db_seeds_user_board_and_columns(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setattr(db, "DB_PATH", db_path)

    db.init_db()

    conn = db.get_connection()
    try:
        users = conn.execute("SELECT username FROM users").fetchall()
        boards = conn.execute("SELECT id FROM boards").fetchall()
        columns = conn.execute('SELECT key, name, "order" FROM columns ORDER BY "order"').fetchall()
    finally:
        conn.close()

    assert [u["username"] for u in users] == ["user"]
    assert len(boards) == 1
    assert [(c["key"], c["name"], c["order"]) for c in columns] == [
        ("backlog", "Backlog", 0),
        ("todo", "To Do", 1),
        ("in_progress", "In Progress", 2),
        ("review", "Review", 3),
        ("done", "Done", 4),
    ]


def test_init_db_is_idempotent(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setattr(db, "DB_PATH", db_path)

    db.init_db()
    db.init_db()
    db.init_db()

    conn = db.get_connection()
    try:
        user_count = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]
        board_count = conn.execute("SELECT COUNT(*) AS n FROM boards").fetchone()["n"]
        column_count = conn.execute("SELECT COUNT(*) AS n FROM columns").fetchone()["n"]
    finally:
        conn.close()

    assert user_count == 1
    assert board_count == 1
    assert column_count == 5


def test_seeded_demo_user_has_password_hash_and_email(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setattr(db, "DB_PATH", db_path)

    db.init_db()

    user = db.get_user_by_username("user")
    assert user["email"] == "user@example.com"
    assert user["password_hash"] is not None
    assert user["password_hash"] != "password"


def test_create_user_creates_user_board_and_columns(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setattr(db, "DB_PATH", db_path)
    db.init_db()

    user_id = db.create_user("alice", "alice@example.com", "correcthorse")

    conn = db.get_connection()
    try:
        board = conn.execute("SELECT id FROM boards WHERE user_id = ?", (user_id,)).fetchone()
        columns = conn.execute(
            'SELECT key FROM columns WHERE board_id = ? ORDER BY "order"', (board["id"],)
        ).fetchall()
    finally:
        conn.close()

    user = db.get_user_by_username("alice")
    assert user["email"] == "alice@example.com"
    assert board is not None
    assert [c["key"] for c in columns] == ["backlog", "todo", "in_progress", "review", "done"]


def test_create_user_duplicate_username_raises_integrity_error(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setattr(db, "DB_PATH", db_path)
    db.init_db()

    db.create_user("alice", "alice@example.com", "correcthorse")

    try:
        db.create_user("alice", "different@example.com", "correcthorse")
        assert False, "expected IntegrityError"
    except sqlite3.IntegrityError:
        pass


def test_init_db_migrates_old_style_users_table(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setattr(db, "DB_PATH", db_path)

    # Simulate a database created before email/password_hash existed.
    conn = sqlite3.connect(db_path)
    conn.execute(
        "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE)"
    )
    conn.execute("INSERT INTO users (username) VALUES ('user')")
    conn.commit()
    conn.close()

    db.init_db()

    user = db.get_user_by_username("user")
    assert user["email"] == "user@example.com"
    assert user["password_hash"] is not None

    conn = db.get_connection()
    try:
        user_count = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]
    finally:
        conn.close()
    assert user_count == 1


def test_create_project_creates_project_board_and_columns(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setattr(db, "DB_PATH", db_path)
    db.init_db()

    board_id = db.create_project("user", "project1")

    conn = db.get_connection()
    try:
        board = conn.execute("SELECT type, name FROM boards WHERE id = ?", (board_id,)).fetchone()
        columns = conn.execute(
            'SELECT key FROM columns WHERE board_id = ? ORDER BY "order"', (board_id,)
        ).fetchall()
    finally:
        conn.close()

    assert board["type"] == "project"
    assert board["name"] == "project1"
    assert [c["key"] for c in columns] == ["backlog", "todo", "in_progress", "review", "done"]


def test_create_project_duplicate_name_raises_integrity_error(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setattr(db, "DB_PATH", db_path)
    db.init_db()

    db.create_project("user", "project1")

    try:
        db.create_project("user", "project1")
        assert False, "expected IntegrityError"
    except sqlite3.IntegrityError:
        pass


def test_init_db_migrates_old_style_boards_table(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setattr(db, "DB_PATH", db_path)

    # Simulate a database created before boards.type/name existed.
    conn = sqlite3.connect(db_path)
    conn.execute(
        "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, "
        "email TEXT, password_hash TEXT)"
    )
    conn.execute("INSERT INTO users (username, email, password_hash) VALUES ('user', 'user@example.com', 'x')")
    conn.execute(
        "CREATE TABLE boards (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, "
        "created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
    )
    conn.execute("INSERT INTO boards (user_id) VALUES (1)")
    conn.execute(
        "CREATE TABLE columns (id INTEGER PRIMARY KEY AUTOINCREMENT, board_id INTEGER NOT NULL, "
        'key TEXT NOT NULL, name TEXT NOT NULL, "order" INTEGER NOT NULL)'
    )
    conn.execute("INSERT INTO columns (board_id, key, name, \"order\") VALUES (1, 'backlog', 'Backlog', 0)")
    conn.execute(
        "CREATE TABLE cards (id INTEGER PRIMARY KEY AUTOINCREMENT, column_id INTEGER NOT NULL, "
        'title TEXT NOT NULL, description TEXT DEFAULT \'\', "order" INTEGER NOT NULL)'
    )
    conn.execute("INSERT INTO cards (column_id, title, \"order\") VALUES (1, 'Pre-migration card', 0)")
    conn.commit()
    conn.close()

    db.init_db()

    conn = db.get_connection()
    try:
        board = conn.execute("SELECT type, name FROM boards WHERE id = 1").fetchone()
        card = conn.execute("SELECT title FROM cards WHERE id = 1").fetchone()
    finally:
        conn.close()

    assert board["type"] == "personal"
    assert board["name"] is None
    assert card["title"] == "Pre-migration card"
