# Tests — Room Availability Calendar

## Structure
| File | Contents |
|------|----------|
| test_tracker.md | 20 manual test cases with steps, expected results, pass/fail column |
| api_test_collection.json | Postman collection — import and run all 20 tests against local or deployed backend |

## How to Run Tests

### Manual testing with Postman
1. Open Postman
2. Click **Import** → select `tests/api_test_collection.json`
3. Set the `baseUrl` variable to `http://localhost:5000` for local or your deployed backend URL
4. Run the **Auth** folder first to get a token — the collection auto-sets `{{token}}` from the login response
5. Run each folder in order: Auth → Rooms → Calendar → Bookings → Operations → Analytics → Admin
6. Record Actual Result and Status (Pass/Fail) in `test_tracker.md`

### How to read test_tracker.md
- Each row is one test case
- **Expected Result** — what a correctly working system returns
- **Actual Result** — fill this in after running the test
- **Status** — write Pass or Fail
- If a test fails, note the error message and report it as a bug in your project report Testing chapter