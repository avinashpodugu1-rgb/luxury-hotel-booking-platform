from flask import current_app


def create_razorpay_order(amount, receipt):
    key_id = current_app.config.get("RAZORPAY_KEY_ID")
    key_secret = current_app.config.get("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        return {"id": f"demo_order_{receipt}", "amount": int(amount * 100), "currency": "INR", "receipt": receipt}

    import razorpay

    client = razorpay.Client(auth=(key_id, key_secret))
    return client.order.create({"amount": int(amount * 100), "currency": "INR", "receipt": receipt})