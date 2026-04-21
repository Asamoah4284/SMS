# School Management System

A School Management System for Ghanaian schools (Nursery to JHS 3).

> **Deployment model:** One instance per school. Clone the repo, set the school details in `.env`, and deploy. Clean isolation — each school owns their data entirely.

---

## Tech Stack

| Layer    | Technology                              |
| -------- | --------------------------------------- |
| Frontend | Next.js 16, React 19, Tailwind CSS 4    |
| Backend  | Express.js 5, Node.js 20+               |
| Database | PostgreSQL 15+ via Prisma ORM           |
| SMS      | Moolre (HTTP API)                      |
| Auth     | JWT (access + refresh tokens)           |

---

## Project Structure

```
SMS/
├── backend/                  Express.js API
│   ├── prisma/
│   │   ├── schema.prisma     Database schema (Prisma)
│   │   └── seed.js           Initial seed data
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js         Prisma client singleton
│   │   │   └── school.js     School identity (name, logo, etc.)
│   │   ├── controllers/      Route handlers
│   │   ├── middleware/       Auth, error handling, validation
│   │   ├── routes/           Express routers
│   │   ├── services/         SMS, PDF services
│   │   └── utils/            Helpers, constants
│   ├── .env.example          All env vars documented
│   └── index.js              Entry point
│
├── frontend/                 Next.js 16 app
│   ├── app/
│   │   ├── (auth)/           Login
│   │   ├── (dashboard)/      Admin + Teacher portal
│   │   │   ├── students/
│   │   │   ├── teachers/
│   │   │   ├── classes/
│   │   │   ├── attendance/
│   │   │   ├── results/
│   │   │   ├── fees/
│   │   │   ├── timetable/
│   │   │   ├── announcements/
│   │   │   └── settings/
│   │   └── (parent-portal)/  Parent read-only view
│   ├── lib/
│   │   ├── api.ts            Fetch wrapper for backend
│   │   └── types.ts          TypeScript types
│   └── components/           Shared UI components
│
└── docs/
    ├── features.md           Full feature list
    └── architecture.md       System design
```

---

## Deploying for a New School

1. Clone the repository
2. Copy `backend/.env.example` to `backend/.env`
3. Fill in the school details:
   ```
   SCHOOL_NAME="St. Mary's Basic School"
   SCHOOL_PHONE="0200000000"
   SCHOOL_EMAIL="info@stmarys.edu.gh"
   ...
   ```
4. Set up the database and run migrations
5. Deploy

If you are deploying the backend on Render, keep Prisma generation tied to install and run migrations as a separate deploy step:

- Install Command: `npm install`
- Build Command: `npx prisma migrate deploy`
- Start Command: `npm start`

The backend already runs `prisma generate` during install via `backend/package.json`, so you do not need to add it again to the Render build command unless your deploy setup skips install hooks.

---

## Getting Started (Development)

### Prerequisites
- Node.js 20+
- PostgreSQL 15+

### Setup

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env

# Set up database
cd backend
npx prisma migrate dev --name init
node prisma/seed.js

# Start dev servers
# Terminal 1:
cd backend && npm run dev

# Terminal 2:
cd frontend && npm run dev
```

Frontend: http://localhost:3000
Backend: http://localhost:5000

---

## Roles

| Role    | Access                                                  |
| ------- | ------------------------------------------------------- |
| ADMIN   | Full access — manage everything                         |
| TEACHER | Classes, attendance, results for their assigned classes |
| PARENT  | Read-only portal for their child's data                 |
