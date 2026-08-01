import anthropic

# Central place to change the model - reused by Part 9's board-aware chat.
MODEL = "claude-opus-5"


def get_client() -> anthropic.Anthropic:
    """Reads credentials from the environment (ANTHROPIC_API_KEY). Reused as-is
    by Part 9, which will add tools/structured outputs on top of this client."""
    return anthropic.Anthropic()


def send_message(prompt: str, max_tokens: int = 1024) -> str:
    client = get_client()
    response = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return next((block.text for block in response.content if block.type == "text"), "")
