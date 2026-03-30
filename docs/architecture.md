# System Architecture

## Overview

Single-school deployment. One database per school. School identity (name, logo, etc.) is stored in environment variables — not in the DB. To deploy for another school: clone the repo, update `.env`, deploy.

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                         │
│                                                             │
│   Admin / Teacher portal      Parent Portal                 │
│   (Next.js dashboard)        (Next.js portal)              │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTPS / REST
┌─────────────────▼───────────────────────────────────────────┐
│                        API LAYER                            │
│                                                             │
│              Express.js 5 — /api/v1/*                       │
│         JWT Auth Middleware │ Role Guard                    │
│                                                             │
│  /auth   /students  /teachers  /classes  /attendance        │
│  /results  /fees  /timetable  /announcements  /reports      │
└─────────────────┬───────────────────────────────────────────┘
                  │ Prisma ORM
┌─────────────────▼───────────────────────────────────────────┐
│                      DATABASE LAYER                         │
│                                                             │
│              PostgreSQL (one database per school)           │
└─────────────────────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                    EXTERNAL SERVICES                        │
│                                                             │
│   Moolre (SMS)               File Storage (local / S3)      │
└─────────────────────────────────────────────────────────────┘
```

---

## Authentication Flow

```
1. User submits phone + password
2. Backend verifies → issues accessToken (15m) + refreshToken (7d)
3. Frontend stores accessToken in memory, refreshToken in httpOnly cookie
4. Each request: Authorization: Bearer <accessToken>
5. Auth middleware validates token → attaches { userId, role } to req.user
6. Role guard checks permissions for the route
7. On accessToken expiry → frontend hits /auth/refresh using cookie
```

---

## Role Permissions

| Resource          | ADMIN       | TEACHER         | PARENT      |
| ----------------- | ----------- | --------------- | ----------- |
| Students          | CRUD        | Read (class)    | Read (own)  |
| Teachers          | CRUD        | Read (own)      | —           |
| Classes           | CRUD        | Read (own)      | Read (child)|
| Attendance        | CRUD        | CRU (class)     | Read (child)|
| Results           | CRUD        | CRU (subject)   | Read (child)|
| Fees              | CRUD        | Read            | Read (child)|
| Announcements     | CRUD        | Create          | Read        |
| Permissions       | CRU (approve)| CRU (own)      | —           |
| Reports           | Full        | Own classes     | —           |
| Settings          | CRUD        | —               | —           |

---

## Database Schema (High-Level)

```
Term
User → Teacher → Class (homeroom)
              → SubjectTeacher → Subject
                              → Class
User → Parent → Student → Class
                        → Attendance
                        → Result → Subject
                        → FeePayment → FeeStructure
Teacher → TeacherAttendance
User → PermissionRequest
Announcement
Timetable → Class + Subject
```

Full schema: `backend/prisma/schema.prisma`

---

## School Identity

Stored in `.env`, not in the database:

```env
SCHOOL_NAME="St. Mary's Basic School"
SCHOOL_LOGO="/logo.png"
SCHOOL_REGION="Ashanti"
...
```

Exposed to frontend via a `/api/v1/school` endpoint that reads from `src/config/school.js`.

---

## SMS Service

Handled server-side in `src/services/sms.js` using the **Moolre** HTTP API (`MOOLRE_API_KEY`, optional `MOOLRE_SENDER_ID`).

Triggered for:
- Permission request approved / rejected
- Fee payment reminders (to parent)
- Low attendance alerts (to parent)
- Results published notification
