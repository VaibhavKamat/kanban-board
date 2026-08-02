import os
import sqlite3
from pathlib import Path

import bcrypt

DB_PATH = Path(os.environ.get("KANBAN_DB_PATH", Path(__file__).parent / "kanban.db"))

HARDCODED_USERNAME = "user"
HARDCODED_PASSWORD = "password"
HARDCODED_EMAIL = "user@example.com"

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
    username TEXT NOT NULL UNIQUE,
    email TEXT,
    password_hash TEXT
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


def _migrate_users_table(conn: sqlite3.Connection) -> None:
    # Covers upgrading a users table created before email/password_hash
    # existed - CREATE TABLE IF NOT EXISTS is a no-op on an already-existing
    # table, so those columns need to be added explicitly.
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(users)").fetchall()}
    if "email" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN email TEXT")
    if "password_hash" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
    # A UNIQUE column constraint can't be added via ALTER TABLE ADD COLUMN in
    # SQLite, so email uniqueness is enforced via a separate index instead -
    # this also makes it apply uniformly to both fresh and migrated tables.
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)")
    conn.commit()


def init_db() -> None:
    conn = get_connection()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
        _migrate_users_table(conn)
        _seed(conn)
    finally:
        conn.close()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def get_user_by_username(username: str) -> sqlite3.Row | None:
    conn = get_connection()
    try:
        return conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    finally:
        conn.close()


def _create_board_with_columns(conn: sqlite3.Connection, user_id: int) -> int:
    board_id = conn.execute("INSERT INTO boards (user_id) VALUES (?)", (user_id,)).lastrowid
    for key, name, order in FIXED_COLUMNS:
        conn.execute(
            'INSERT INTO columns (board_id, key, name, "order") VALUES (?, ?, ?, ?)',
            (board_id, key, name, order),
        )
    return board_id


def create_user(username: str, email: str, password: str) -> int:
    conn = get_connection()
    try:
        user_id = conn.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (username, email, hash_password(password)),
        ).lastrowid
        _create_board_with_columns(conn, user_id)
        conn.commit()
        return user_id
    finally:
        conn.close()


def _seed(conn: sqlite3.Connection) -> None:
    user = conn.execute(
        "SELECT id, email, password_hash FROM users WHERE username = ?", (HARDCODED_USERNAME,)
    ).fetchone()
    if user is None:
        user_id = conn.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (HARDCODED_USERNAME, HARDCODED_EMAIL, hash_password(HARDCODED_PASSWORD)),
        ).lastrowid
    else:
        user_id = user["id"]
        if user["email"] is None or user["password_hash"] is None:
            conn.execute(
                "UPDATE users SET email = ?, password_hash = ? WHERE id = ?",
                (HARDCODED_EMAIL, hash_password(HARDCODED_PASSWORD), user_id),
            )

    board = conn.execute("SELECT id FROM boards WHERE user_id = ?", (user_id,)).fetchone()
    if board is None:
        _create_board_with_columns(conn, user_id)
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
