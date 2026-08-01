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
        "order": row["order"],
    }


def _get_board_id_for_user(conn: sqlite3.Connection, username: str) -> int:
    row = conn.execute(
        """
        SELECT boards.id FROM boards
        JOIN users ON users.id = boards.user_id
        WHERE users.username = ?
        """,
        (username,),
    ).fetchone()
    if row is None:
        raise LookupError(f"No board for user {username!r}")
    return row["id"]


def _resequence(conn: sqlite3.Connection, ordered_card_ids: list[int]) -> None:
    for index, card_id in enumerate(ordered_card_ids):
        conn.execute('UPDATE cards SET "order" = ? WHERE id = ?', (index, card_id))


def get_board(username: str) -> dict:
    conn = get_connection()
    try:
        board_id = _get_board_id_for_user(conn, username)
        columns = conn.execute(
            'SELECT id, key, name, "order" FROM columns WHERE board_id = ? ORDER BY "order"',
            (board_id,),
        ).fetchall()

        column_ids = [c["id"] for c in columns]
        if column_ids:
            placeholders = ",".join("?" for _ in column_ids)
            cards = conn.execute(
                f'SELECT id, column_id, title, description, "order" FROM cards '
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
        board_id = _get_board_id_for_user(conn, username)
        result = conn.execute(
            "UPDATE columns SET name = ? WHERE id = ? AND board_id = ?",
            (name, column_id, board_id),
        )
        if result.rowcount == 0:
            raise LookupError("Column not found")
        conn.commit()
    finally:
        conn.close()
    return get_board(username)


def create_card(username: str, column_id: int, title: str, description: str) -> dict:
    conn = get_connection()
    try:
        board_id = _get_board_id_for_user(conn, username)
        column = conn.execute(
            "SELECT id FROM columns WHERE id = ? AND board_id = ?", (column_id, board_id)
        ).fetchone()
        if column is None:
            raise LookupError("Column not found")

        next_order = conn.execute(
            "SELECT COUNT(*) AS n FROM cards WHERE column_id = ?", (column_id,)
        ).fetchone()["n"]

        conn.execute(
            'INSERT INTO cards (column_id, title, description, "order") VALUES (?, ?, ?, ?)',
            (column_id, title, description, next_order),
        )
        conn.commit()
    finally:
        conn.close()
    return get_board(username)


def update_card(
    username: str,
    card_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    target_column_id: Optional[int] = None,
    target_order: Optional[int] = None,
) -> dict:
    conn = get_connection()
    try:
        board_id = _get_board_id_for_user(conn, username)
        card = conn.execute(
            """
            SELECT cards.id, cards.column_id FROM cards
            JOIN columns ON columns.id = cards.column_id
            WHERE cards.id = ? AND columns.board_id = ?
            """,
            (card_id, board_id),
        ).fetchone()
        if card is None:
            raise LookupError("Card not found")

        if title is not None or description is not None:
            fields = []
            params: list = []
            if title is not None:
                fields.append("title = ?")
                params.append(title)
            if description is not None:
                fields.append("description = ?")
                params.append(description)
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
    return get_board(username)


def get_column_id_by_key(username: str, key: str) -> int:
    conn = get_connection()
    try:
        board_id = _get_board_id_for_user(conn, username)
        row = conn.execute(
            "SELECT id FROM columns WHERE board_id = ? AND key = ?", (board_id, key)
        ).fetchone()
        if row is None:
            raise LookupError(f"Unknown column key {key!r}")
        return row["id"]
    finally:
        conn.close()


def get_recent_messages(username: str, limit: int = 20) -> list[dict]:
    conn = get_connection()
    try:
        board_id = _get_board_id_for_user(conn, username)
        rows = conn.execute(
            "SELECT role, content FROM messages WHERE board_id = ? ORDER BY id DESC LIMIT ?",
            (board_id, limit),
        ).fetchall()
        return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]
    finally:
        conn.close()


def add_message(username: str, role: str, content: str) -> None:
    conn = get_connection()
    try:
        board_id = _get_board_id_for_user(conn, username)
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
        board_id = _get_board_id_for_user(conn, username)
        card = conn.execute(
            """
            SELECT cards.id, cards.column_id FROM cards
            JOIN columns ON columns.id = cards.column_id
            WHERE cards.id = ? AND columns.board_id = ?
            """,
            (card_id, board_id),
        ).fetchone()
        if card is None:
            raise LookupError("Card not found")

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
    return get_board(username)
