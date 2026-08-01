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
