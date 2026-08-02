import sqlite3
from typing import Optional

from db import get_connection


def _row_to_column(row: sqlite3.Row) -> dict:
    return {
        "id": str(row["id"]),
        "key": row["key"],
        "name": row["name"],
        "order": row["order"],
    }


def _row_to_card(row: sqlite3.Row) -> dict:
    return {
        "id": str(row["id"]),
        "columnId": str(row["column_id"]),
        "title": row["title"],
        "description": row["description"],
        "dueDate": row["due_date"],
        "order": row["order"],
    }


def resolve_personal_board_id(conn: sqlite3.Connection, username: str) -> int:
    row = conn.execute(
        """
        SELECT boards.id FROM boards
        JOIN users ON users.id = boards.user_id
        WHERE users.username = ? AND boards.type = 'personal'
        """,
        (username,),
    ).fetchone()
    if row is None:
        raise LookupError(f"No personal board for user {username!r}")
    return row["id"]


def get_personal_board_id(username: str) -> int:
    conn = get_connection()
    try:
        return resolve_personal_board_id(conn, username)
    finally:
        conn.close()


def _assert_board_access(conn: sqlite3.Connection, username: str, board_id: int) -> None:
    row = conn.execute(
        """
        SELECT boards.type AS type, users.username AS owner_username
        FROM boards
        JOIN users ON users.id = boards.user_id
        WHERE boards.id = ?
        """,
        (board_id,),
    ).fetchone()
    if row is None:
        raise LookupError(f"No board with id {board_id!r}")
    if row["type"] == "project":
        return
    if row["owner_username"] != username:
        raise LookupError(f"No board with id {board_id!r}")


def list_boards(username: str) -> list[dict]:
    conn = get_connection()
    try:
        personal = conn.execute(
            """
            SELECT boards.id, boards.type, boards.name FROM boards
            JOIN users ON users.id = boards.user_id
            WHERE users.username = ? AND boards.type = 'personal'
            """,
            (username,),
        ).fetchone()
        projects = conn.execute(
            "SELECT id, type, name FROM boards WHERE type = 'project' ORDER BY name"
        ).fetchall()

        result = []
        if personal is not None:
            result.append({"id": str(personal["id"]), "type": personal["type"], "name": personal["name"]})
        result.extend(
            {"id": str(p["id"]), "type": p["type"], "name": p["name"]} for p in projects
        )
        return result
    finally:
        conn.close()


def _resequence(conn: sqlite3.Connection, ordered_card_ids: list[int]) -> None:
    for index, card_id in enumerate(ordered_card_ids):
        conn.execute('UPDATE cards SET "order" = ? WHERE id = ?', (index, card_id))


def get_board(username: str, board_id: Optional[int] = None) -> dict:
    conn = get_connection()
    try:
        if board_id is None:
            board_id = resolve_personal_board_id(conn, username)
        else:
            _assert_board_access(conn, username, board_id)

        columns = conn.execute(
            'SELECT id, key, name, "order" FROM columns WHERE board_id = ? ORDER BY "order"',
            (board_id,),
        ).fetchall()

        column_ids = [c["id"] for c in columns]
        if column_ids:
            placeholders = ",".join("?" for _ in column_ids)
            cards = conn.execute(
                f'SELECT id, column_id, title, description, due_date, "order" FROM cards '
                f'WHERE column_id IN ({placeholders}) ORDER BY column_id, "order"',
                column_ids,
            ).fetchall()
        else:
            cards = []

        return {
            "columns": [_row_to_column(c) for c in columns],
            "cards": [_row_to_card(c) for c in cards],
        }
    finally:
        conn.close()


def rename_column(username: str, column_id: int, name: str) -> dict:
    conn = get_connection()
    try:
        column = conn.execute(
            "SELECT board_id FROM columns WHERE id = ?", (column_id,)
        ).fetchone()
        if column is None:
            raise LookupError("Column not found")
        board_id = column["board_id"]
        _assert_board_access(conn, username, board_id)

        conn.execute("UPDATE columns SET name = ? WHERE id = ?", (name, column_id))
        conn.commit()
    finally:
        conn.close()
    return get_board(username, board_id)


def create_card(
    username: str, column_id: int, title: str, description: str, due_date: Optional[str] = None
) -> dict:
    conn = get_connection()
    try:
        column = conn.execute(
            "SELECT board_id FROM columns WHERE id = ?", (column_id,)
        ).fetchone()
        if column is None:
            raise LookupError("Column not found")
        board_id = column["board_id"]
        _assert_board_access(conn, username, board_id)

        next_order = conn.execute(
            "SELECT COUNT(*) AS n FROM cards WHERE column_id = ?", (column_id,)
        ).fetchone()["n"]

        conn.execute(
            'INSERT INTO cards (column_id, title, description, due_date, "order") '
            "VALUES (?, ?, ?, ?, ?)",
            (column_id, title, description, due_date or None, next_order),
        )
        conn.commit()
    finally:
        conn.close()
    return get_board(username, board_id)


def update_card(
    username: str,
    card_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    due_date: Optional[str] = None,
    target_column_id: Optional[int] = None,
    target_order: Optional[int] = None,
) -> dict:
    conn = get_connection()
    try:
        card = conn.execute(
            """
            SELECT cards.id, cards.column_id, columns.board_id AS board_id FROM cards
            JOIN columns ON columns.id = cards.column_id
            WHERE cards.id = ?
            """,
            (card_id,),
        ).fetchone()
        if card is None:
            raise LookupError("Card not found")
        board_id = card["board_id"]
        _assert_board_access(conn, username, board_id)

        if title is not None or description is not None or due_date is not None:
            fields = []
            params: list = []
            if title is not None:
                fields.append("title = ?")
                params.append(title)
            if description is not None:
                fields.append("description = ?")
                params.append(description)
            if due_date is not None:
                fields.append("due_date = ?")
                # An empty string means "clear the due date" - store NULL,
                # not "", so it matches the no-due-date state of a new card.
                params.append(due_date or None)
            fields.append("updated_at = CURRENT_TIMESTAMP")
            params.append(card_id)
            conn.execute(f"UPDATE cards SET {', '.join(fields)} WHERE id = ?", params)

        if target_column_id is not None:
            target_column = conn.execute(
                "SELECT id FROM columns WHERE id = ? AND board_id = ?",
                (target_column_id, board_id),
            ).fetchone()
            if target_column is None:
                raise LookupError("Target column not found")

            source_column_id = card["column_id"]

            remaining_source = [
                r["id"]
                for r in conn.execute(
                    'SELECT id FROM cards WHERE column_id = ? AND id != ? ORDER BY "order"',
                    (source_column_id, card_id),
                ).fetchall()
            ]

            if source_column_id == target_column_id:
                target_list = remaining_source
            else:
                target_list = [
                    r["id"]
                    for r in conn.execute(
                        'SELECT id FROM cards WHERE column_id = ? ORDER BY "order"',
                        (target_column_id,),
                    ).fetchall()
                ]

            index = (
                len(target_list)
                if target_order is None
                else max(0, min(target_order, len(target_list)))
            )
            target_list.insert(index, card_id)

            conn.execute(
                "UPDATE cards SET column_id = ? WHERE id = ?", (target_column_id, card_id)
            )
            _resequence(conn, target_list)

            if source_column_id != target_column_id:
                _resequence(conn, remaining_source)

        conn.commit()
    finally:
        conn.close()
    return get_board(username, board_id)


def get_column_id_by_key(username: str, board_id: int, key: str) -> int:
    conn = get_connection()
    try:
        _assert_board_access(conn, username, board_id)
        row = conn.execute(
            "SELECT id FROM columns WHERE board_id = ? AND key = ?", (board_id, key)
        ).fetchone()
        if row is None:
            raise LookupError(f"Unknown column key {key!r}")
        return row["id"]
    finally:
        conn.close()


def get_recent_messages(username: str, board_id: int, limit: int = 20) -> list[dict]:
    conn = get_connection()
    try:
        _assert_board_access(conn, username, board_id)
        rows = conn.execute(
            "SELECT id, role, content FROM messages WHERE board_id = ? ORDER BY id DESC LIMIT ?",
            (board_id, limit),
        ).fetchall()
        return [
            {"id": str(r["id"]), "role": r["role"], "content": r["content"]}
            for r in reversed(rows)
        ]
    finally:
        conn.close()


def add_message(username: str, board_id: int, role: str, content: str) -> None:
    conn = get_connection()
    try:
        _assert_board_access(conn, username, board_id)
        conn.execute(
            "INSERT INTO messages (board_id, role, content) VALUES (?, ?, ?)",
            (board_id, role, content),
        )
        conn.commit()
    finally:
        conn.close()


def delete_card(username: str, card_id: int) -> dict:
    conn = get_connection()
    try:
        card = conn.execute(
            """
            SELECT cards.id, cards.column_id, columns.board_id AS board_id FROM cards
            JOIN columns ON columns.id = cards.column_id
            WHERE cards.id = ?
            """,
            (card_id,),
        ).fetchone()
        if card is None:
            raise LookupError("Card not found")
        board_id = card["board_id"]
        _assert_board_access(conn, username, board_id)

        conn.execute("DELETE FROM cards WHERE id = ?", (card_id,))

        remaining = [
            r["id"]
            for r in conn.execute(
                'SELECT id FROM cards WHERE column_id = ? ORDER BY "order"',
                (card["column_id"],),
            ).fetchall()
        ]
        _resequence(conn, remaining)
        conn.commit()
    finally:
        conn.close()
    return get_board(username, board_id)
