def create_payment_order(amount: float, receipt: str) -> dict:
    """Create a simple demo payment order (no external gateway)."""
    return {
        "id": f"demo_order_{receipt}",
        "amount": int(amount * 100),
        "currency": "INR",
        "receipt": receipt,
    }
