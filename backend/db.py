import os
import sqlite3
from pathlib import Path

DB_PATH = Path(os.environ.get("KANBAN_DB_PATH", Path(__file__).parent / "kanban.db"))

HARDCODED_USERNAME = "user"

FIXED_COLUMNS = [
    ("backlog", "Backlog", 0),
    ("todo", "To Do", 1),
    ("in_progress", "In Progress", 2),
    ("review", "Review", 3),
    ("done", "Done", 4),
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS columns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL REFERENCES boards(id),
    key TEXT NOT NULL,
    name TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    UNIQUE(board_id, key)
);

CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    column_id INTEGER NOT NULL REFERENCES columns(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL REFERENCES boards(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    conn = get_connection()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
        _seed(conn)
    finally:
        conn.close()


def _seed(conn: sqlite3.Connection) -> None:
    user = conn.execute(
        "SELECT id FROM users WHERE username = ?", (HARDCODED_USERNAME,)
    ).fetchone()
    if user is None:
        user_id = conn.execute(
            "INSERT INTO users (username) VALUES (?)", (HARDCODED_USERNAME,)
        ).lastrowid
    else:
        user_id = user["id"]

    board = conn.execute("SELECT id FROM boards WHERE user_id = ?", (user_id,)).fetchone()
    if board is None:
        board_id = conn.execute(
            "INSERT INTO boards (user_id) VALUES (?)", (user_id,)
        ).lastrowid
    else:
        board_id = board["id"]

    for key, name, order in FIXED_COLUMNS:
        existing = conn.execute(
            "SELECT id FROM columns WHERE board_id = ? AND key = ?", (board_id, key)
        ).fetchone()
        if existing is None:
            conn.execute(
                'INSERT INTO columns (board_id, key, name, "order") VALUES (?, ?, ?, ?)',
                (board_id, key, name, order),
            )

    conn.commit()
