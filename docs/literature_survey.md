# Literature Survey — Room Availability Calendar

## 1. Existing System Analysis

### System 1 — Oracle OPERA Property Management System
**Overview:** OPERA PMS is the industry-standard hotel management platform used by major hotel chains globally including Marriott and Hilton.

**Features:**
- Full property management: reservations, check-in/out, housekeeping, billing
- Channel management: connects to OTAs like Booking.com and Expedia
- Revenue management: dynamic pricing based on occupancy
- Reporting: daily revenue, occupancy analytics, GST reports

**Limitations:**
- Very expensive licensing — not viable for small hotels or internship prototypes
- Steep learning curve with complex configuration
- No open-source API for customisation
- Cloud version requires enterprise contract
- Overkill for a single-property boutique hotel like SRI NIRVANA PLAZA

---

### System 2 — Hotelogix Cloud PMS
**Overview:** Hotelogix is a cloud-based PMS targeting small to mid-size hotels in Asia and Africa.

**Features:**
- Front desk management, booking engine, housekeeping status
- Web-based room availability calendar
- Reports for occupancy, revenue, guest history

**Limitations:**
- Proprietary closed system — cannot extend or modify
- Limited customisation of workflows
- No rule-based AI allocation suggestions
- GST reports require manual reconciliation
- No corporate booking portal or self check-in kiosk flow
- Subscription-based pricing with no free tier

---

### System 3 — Manual Tracking using Google Sheets / Microsoft Excel
**Overview:** Many small hotels in India, including budget properties, still manage room availability using spreadsheets shared via WhatsApp or Google Drive.

**Features:**
- Zero cost
- Familiar to all staff
- Flexible layout

**Limitations:**
- No conflict prevention — double bookings happen frequently
- No real-time update — two receptionists editing the same sheet causes data loss
- No automated confirmations or reminders
- No audit trail for who changed what
- Cannot scale beyond 10-15 rooms without becoming unmanageable
- No GST calculation, no loyalty tracking, no corporate booking management

---

## 2. Proposed System — Room Availability Calendar

The proposed Room Availability Calendar fills the gap between expensive enterprise systems and error-prone manual tracking.

### Comparison Table

| Feature | OPERA PMS | Hotelogix | Google Sheets | Proposed System |
|---------|-----------|-----------|---------------|-----------------|
| Real-time conflict prevention | Yes | Yes | No | Yes (Firestore transaction) |
| Open source / customisable | No | No | Yes | Yes |
| Role-based access | Yes | Yes | No | Yes (admin/customer JWT) |
| Room availability calendar | Yes | Yes | Manual | Yes (colour-coded grid) |
| AI / rule-based allocation | No | No | No | Yes (analytics_controller.py) |
| GST auto-generation | Yes | Partial | No | Yes (gst_service.py) |
| Corporate booking module | Yes | Partial | No | Yes |
| Self check-in flow | Some versions | No | No | Yes |
| Housekeeping tracker | Yes | Yes | No | Yes |
| Complaint management | Yes | No | No | Yes |
| Deployment cost | High | Medium | Free | Free (Firebase + Render + Vercel) |
| Suitable for internship project | No | No | N/A | Yes |

---

## 3. References (IEEE Format)

[1] Oracle Corporation, "OPERA Cloud Property Management," Oracle Hospitality, 2024. [Online]. Available: https://www.oracle.com/hospitality/hotel-property-management/

[2] Hotelogix Pvt. Ltd., "Hotelogix Cloud PMS Features," Hotelogix, 2024. [Online]. Available: https://www.hotelogix.com/features/

[3] D. Buhalis and R. Law, "Progress in information technology and tourism management: 20 years on and 10 years after the internet — The state of eTourism research," *Tourism Management*, vol. 29, no. 4, pp. 609–623, 2008.

[4] Google LLC, "Firebase Firestore Documentation," Google Firebase, 2024. [Online]. Available: https://firebase.google.com/docs/firestore

[5] A. Raghuvanshi and S. Sharma, "Cloud-Based Hotel Management System Using React and Node.js," *International Journal of Computer Applications*, vol. 183, no. 12, pp. 1–6, 2021.