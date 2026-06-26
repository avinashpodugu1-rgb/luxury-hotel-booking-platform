import unittest

from services.notification_service import booking_confirmation_email_body


class BookingConfirmationEmailTests(unittest.TestCase):
    def test_booking_confirmation_email_mentions_confirmed_dates(self):
        booking = {
            "id": "bk_123",
            "guest_name": "Asha",
            "check_in": "2026-07-01",
            "check_out": "2026-07-03",
            "room_number": "101",
            "total_amount": 2500,
        }

        body = booking_confirmation_email_body(booking, "SNP-2026-000001")

        self.assertIn("Your booking is confirmed", body)
        self.assertIn("2026-07-01", body)
        self.assertIn("2026-07-03", body)
        self.assertIn("SNP-2026-000001", body)


if __name__ == "__main__":
    unittest.main()
