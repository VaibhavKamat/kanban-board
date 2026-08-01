from types import SimpleNamespace
from unittest.mock import MagicMock

import anthropic

import ai


class FakeTextBlock:
    def __init__(self, text):
        self.type = "text"
        self.text = text


def test_send_message_extracts_text_from_response(monkeypatch):
    fake_response = SimpleNamespace(content=[FakeTextBlock("4")])
    fake_client = MagicMock()
    fake_client.messages.create.return_value = fake_response
    monkeypatch.setattr(ai, "get_client", lambda: fake_client)

    result = ai.send_message("What is 2+2? Reply with just the number.")

    assert result == "4"
    fake_client.messages.create.assert_called_once_with(
        model=ai.MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": "What is 2+2? Reply with just the number."}],
    )


def test_send_message_ignores_non_text_blocks(monkeypatch):
    non_text_block = SimpleNamespace(type="thinking")
    fake_response = SimpleNamespace(content=[non_text_block, FakeTextBlock("4")])
    fake_client = MagicMock()
    fake_client.messages.create.return_value = fake_response
    monkeypatch.setattr(ai, "get_client", lambda: fake_client)

    assert ai.send_message("What is 2+2?") == "4"


def test_ai_test_route_requires_auth(client):
    assert client.get("/api/ai-test").status_code == 401


def test_ai_test_route_returns_reply(auth_client, monkeypatch):
    monkeypatch.setattr("main.send_message", lambda prompt: "4")

    response = auth_client.get("/api/ai-test")

    assert response.status_code == 200
    assert response.json() == {"reply": "4"}


def test_ai_test_route_handles_anthropic_error_cleanly(auth_client, monkeypatch):
    def raise_error(prompt):
        raise anthropic.AnthropicError("ANTHROPIC_API_KEY is not set")

    monkeypatch.setattr("main.send_message", raise_error)

    response = auth_client.get("/api/ai-test")

    assert response.status_code == 500
    assert "AI request failed" in response.json()["detail"]


def test_ai_test_route_handles_missing_credentials_cleanly(auth_client, monkeypatch):
    # The Anthropic SDK raises a bare TypeError (not anthropic.AnthropicError)
    # when no credentials are resolvable - this is the real failure mode when
    # ANTHROPIC_API_KEY is unset, so it must be caught too, not just the
    # AnthropicError family.
    def raise_error(prompt):
        raise TypeError("Could not resolve authentication method.")

    monkeypatch.setattr("main.send_message", raise_error)

    response = auth_client.get("/api/ai-test")

    assert response.status_code == 500
    assert "AI request failed" in response.json()["detail"]
