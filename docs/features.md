# EduTrack SMS — Full Feature Specification

Target market: Ghanaian schools (Nursery 1 → JHS 3)
Pricing: ₵10 per active student per term

---

## 1. Multi-School / Multi-Tenant

- Each school gets its own isolated data space (school ID scoped)
- School profile: name, logo, motto, address, region, district, phone, email
- Custom school slug for URL and branding (e.g., `stmary.edutrack.app`)
- School admin manages their own users and configuration
- Super admin (platform owner) manages all schools, billing, and subscriptions

---

## 2. Academic Calendar

- Define academic years (e.g., 2024/2025)
- Three terms per year (First, Second, Third)
- Set term start/end dates
- Mark active term — drives attendance, results, and fee calculations
- Holiday and event calendar per school

---

## 3. Student Management

- Student enrollment with: name, DOB, gender, photo, parent contact, address
- Auto-generated student ID per school
- Assign student to a class and section
- Track enrollment history (class transfers across terms)
- **Promotion system**: at end of term, bulk-promote students to the next class based on exam results
- Students who fail can be held back (manually flagged)
- Deactivate / transfer-out students without deleting records

---

## 4. Class Management

- Class levels: Nursery 1, Nursery 2, KG 1, KG 2, Basic 1–6, JHS 1–3
- Optional sections per level (e.g., Basic 4A, Basic 4B)
- Assign a class teacher (homeroom teacher) to each class
- View full class list with student details
- Teachers can update and manage their class list

---

## 5. Subject Management

- Define subjects per school (e.g., Maths, English, Science, RME, Twi)
- Assign subject teachers to subjects per class
  - One teacher can teach multiple subjects or classes
- Subject codes for reporting

---

## 6. Teacher Management

- Teacher profiles: name, staff ID, phone, qualification, photo
- View assigned classes and subjects
- **Permission Requests**: teachers submit leave requests (sick leave, personal, maternity, etc.)
  - Admin reviews and approves/rejects via dashboard
  - Teacher is notified of decision via SMS automatically

---

## 7. Attendance

### Student Attendance
- Mark attendance daily per class: Present, Absent, Late, Excused
- Class teacher marks attendance from their class list
- Monthly and termly attendance summary per student
- Attendance rate shown on student profile and parent portal

### Teacher Attendance
- Automatically tracked when teacher logs in on a school day (check-in time recorded)
- Admin can also manually update teacher attendance
- Monthly attendance report for payroll support

---

## 8. Examination & Results

- GES-standard scoring:
  - Class score: 30 marks
  - Exam score: 70 marks
  - Total: 100 marks
- Auto-calculated grade based on score range:
  - 80–100 → A1 (Excellent)
  - 70–79  → B2 (Very Good)
  - 60–69  → B3 (Good)
  - 50–59  → C4 (Credit)
  - 45–49  → C5 (Credit)
  - 40–44  → C6 (Credit)
  - 35–39  → D7 (Pass)
  - 30–34  → E8 (Pass)
  - 0–29   → F9 (Fail)
- Teacher remarks per subject
- End-of-term report card (printable PDF)
- Position / ranking in class
- **Promotion decision**: based on overall performance and teacher recommendation
- Results history is preserved across terms and years

---

## 9. Fee Management

- Define fee structures per term and class level
  (e.g., Basic 1–3 pays ₵500, JHS pays ₵700)
- Record fee payments per student per term:
  - **Fully Paid** — paid 100% of fee
  - **Half Paid** — paid 50%
  - **Custom Amount** — pay any amount (partial)
  - **Unpaid** — no payment recorded
- Auto-calculate outstanding balance
- Generate printable payment receipt
- Fee defaulter list — filter students with unpaid/outstanding fees
- Send SMS reminders to parents of defaulters

---

## 10. Parent Portal

- Parent logs in with their phone number + PIN
- View each child's:
  - Current class and class teacher
  - Attendance record (daily + summary)
  - Subject results and grades
  - Fee payment status and outstanding balance
  - Report card (view / download PDF)
  - School announcements
- Parent cannot edit any data — read-only access
- Link one parent account to multiple children

---

## 11. Announcements & Notifications

- Admin or teacher creates announcements
- Audience targeting: All, Teachers only, Parents only, Specific class
- Announcements appear in dashboard and parent portal
- **SMS Notifications** sent via Hubtel/Arkesel for:
  - Approved/rejected permission requests
  - Fee payment reminders
  - Exam results published
  - Important school announcements
  - Low attendance alerts to parents

---

## 12. Timetable

- Weekly timetable per class (Monday–Friday)
- Assign subject + teacher to each time slot
- Visible to teachers and parents
- Conflict detection (same teacher in two places at once)

---

## 13. Reports & Analytics (Admin Dashboard)

- Total students enrolled this term
- Attendance rate across school
- Fee collection rate (% paid, total collected vs expected)
- Subject performance averages
- Teacher attendance summary
- Class-level performance comparison
- Export reports to PDF or Excel

---

## 14. Subscription & Billing (SaaS)

- ₵10 per active student per term
- Invoice generated automatically at start of each term
- Payment tracked (paid / outstanding)
- School suspended after grace period of unpaid subscription
- Super admin dashboard: all schools, revenue, active users

---

## Roadmap (Future Features)

- [ ] Mobile app for parents (React Native)
- [ ] Online fee payment via MTN MoMo / Telecel Cash
- [ ] Library management (books, borrowing records)
- [ ] School bus tracking
- [ ] Staff payroll integration
- [ ] WhatsApp notifications (in addition to SMS)
- [ ] CBT (Computer-Based Testing) for internal exams
- [ ] Custom report card templates
- [ ] Multi-language support (Twi, Ga, Hausa)
