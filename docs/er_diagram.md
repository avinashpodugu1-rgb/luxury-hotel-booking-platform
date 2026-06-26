# Entity-Relationship Diagram — Room Availability Calendar

## Collections and Relationships

### users
| Field | Type | Notes |
|-------|------|-------|
| id | string (auto) | Primary key |
| full_name | string | Required |
| email | string | Unique, required |
| phone | string | Optional |
| password_hash | string | Hashed with werkzeug |
| role | string | 'customer' or 'admin' |
| google_id | string | Optional, for OAuth |
| avatar_url | string | Optional |
| created_at | timestamp | Auto |

### rooms
| Field | Type | Notes |
|-------|------|-------|
| id | string (room_number) | Primary key |
| room_number | string | e.g. '101', '205' |
| room_type | string | Single, Deluxe, Double, Suite, Executive Suite |
| category | string | Same as room_type |
| floor | string | e.g. 'Floor 1' |
| capacity | integer | Max guests |
| price | decimal | Per night in INR |
| status | string | available, booked, maintenance, out-of-service |
| booked_dates | array[string] | ISO date strings e.g. ['2026-07-01'] |
| blocked_dates | array[string] | ISO date strings |
| amenities | array[string] | List of amenity names |
| images | array[string] | Image URLs |
| created_at | timestamp | Auto |

### bookings
| Field | Type | Notes |
|-------|------|-------|
| id | string (auto) | Primary key |
| user_id | string | → users.id |
| room_id | string | → rooms.id |
| room_number | string | Denormalised for display |
| room_type | string | Denormalised |
| guest_name | string | |
| phone | string | |
| email | string | |
| check_in | string | ISO date |
| check_out | string | ISO date |
| stay_dates | array[string] | All nights of stay |
| guests | integer | Number of guests |
| guest_details | array[object] | [{name, age, gender, idProof}] |
| max_occupancy | integer | Room capacity at time of booking |
| status | string | confirmed, checked-in, checked-out, cancelled |
| payment_method | string | Razorpay, UPI, Card |
| subtotal | decimal | |
| taxes | decimal | 12% of subtotal |
| service_charge | decimal | 8% of subtotal |
| total_amount | decimal | subtotal + taxes + service_charge |
| created_at | timestamp | Auto |

### payments
| Field | Type | Notes |
|-------|------|-------|
| id | string (auto) | Primary key |
| booking_id | string | → bookings.id (optional) |
| provider | string | 'Razorpay', 'UPI', 'Card' |
| provider_order_id | string | From Razorpay |
| provider_payment_id | string | From Razorpay after success |
| invoice_number | string | Unique e.g. SNP-ABC12345 |
| amount | decimal | INR |
| status | string | created, paid, failed |
| created_at | timestamp | Auto |

### gst_entries
| Field | Type | Notes |
|-------|------|-------|
| id | string (auto) | Primary key |
| booking_id | string | → bookings.id |
| invoice_number | string | Matches payment invoice |
| taxable_amount | decimal | Pre-tax base amount |
| cgst | decimal | 6% of taxable_amount |
| sgst | decimal | 6% of taxable_amount |
| total_tax | decimal | cgst + sgst |
| total_amount | decimal | Full amount with tax |
| created_at | timestamp | Auto |

### reviews
| Field | Type | Notes |
|-------|------|-------|
| id | string (auto) | Primary key |
| user_id | string | → users.id |
| user_name | string | Denormalised |
| room_id | string | → rooms.id |
| rating | integer | 1–5 |
| comment | text | Required |
| photo_url | string | Optional |
| created_at | timestamp | Auto |

### wishlists
| Field | Type | Notes |
|-------|------|-------|
| id | string (user_id + room_id) | Unique per user-room pair |
| user_id | string | → users.id |
| room_id | string | → rooms.id |
| created_at | timestamp | Auto |

### enquiries
| Field | Type | Notes |
|-------|------|-------|
| id | string (auto) | |
| name | string | Guest name |
| phone | string | |
| email | string | |
| message | text | |
| room_type | string | |
| preferred_dates | string | |
| status | string | pending, contacted, converted, closed |
| owner | string | Staff assigned |
| source | string | walk-in, phone, website, corporate |
| created_at | timestamp | Auto |

### corporate_bookings
| Field | Type | Notes |
|-------|------|-------|
| id | string (auto) | |
| company_name | string | |
| contact_person | string | |
| phone | string | |
| email | string | |
| room_count | integer | |
| check_in | string | ISO date |
| check_out | string | ISO date |
| status | string | pending, approved, rejected |
| notes | text | |
| created_at | timestamp | Auto |

### housekeeping_tasks
| Field | Type | Notes |
|-------|------|-------|
| id | string (auto) | |
| room_id | string | → rooms.id |
| task_type | string | cleaning, linen-change, maintenance-support |
| status | string | pending, in-progress, completed |
| assigned_to | string | Staff name |
| priority | string | Low, Medium, High |
| notes | text | |
| completed_at | timestamp | Optional |
| created_at | timestamp | Auto |

### room_service_orders
| Field | Type | Notes |
|-------|------|-------|
| id | string (auto) | |
| booking_id | string | → bookings.id |
| room_id | string | → rooms.id |
| item | string | e.g. 'Extra towels' |
| quantity | integer | |
| status | string | pending, in-progress, completed |
| notes | text | |
| created_at | timestamp | Auto |

### complaints
| Field | Type | Notes |
|-------|------|-------|
| id | string (auto) | |
| user_id | string | → users.id |
| room_id | string | → rooms.id |
| category | string | noise, cleanliness, service, maintenance |
| description | text | |
| status | string | open, under-review, resolved |
| priority | string | Low, Medium, High |
| resolved_at | timestamp | Optional |
| created_at | timestamp | Auto |

### feedback
| Field | Type | Notes |
|-------|------|-------|
| id | string (auto) | |
| user_id | string | → users.id |
| booking_id | string | → bookings.id |
| rating | integer | 1–5 |
| comment | text | |
| category | string | stay, food, service, cleanliness |
| created_at | timestamp | Auto |

### maintenance_blocks
| Field | Type | Notes |
|-------|------|-------|
| id | string (auto) | |
| room_id | string | → rooms.id |
| start_date | string | ISO date |
| end_date | string | ISO date |
| reason | string | e.g. 'AC repair' |
| created_by | string | Staff name |
| status | string | active, in-progress, completed |
| created_at | timestamp | Auto |

### shift_handover_logs
| Field | Type | Notes |
|-------|------|-------|
| id | string (auto) | |
| shift_date | string | ISO date |
| outgoing_staff | string | |
| incoming_staff | string | |
| notes | text | Issues, pending tasks, special guests |
| created_at | timestamp | Auto |

## Relationships Summary

```
users ──< bookings >── rooms
users ──< reviews >── rooms
users ──< wishlists >── rooms
bookings ──< payments
bookings ── gst_entries
bookings ──< room_service_orders
rooms ──< housekeeping_tasks
rooms ──< maintenance_blocks
rooms ──< complaints
```