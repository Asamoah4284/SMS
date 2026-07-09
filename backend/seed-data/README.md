# School data import (CSV)

Fill in the CSV files in this folder, then run:

```bash
cd backend
npm run db:import
```

This imports **your school's real data** into the database. Use `npm run db:seed` only for the full demo dataset (Eagle's Nest sample school).

## Files (fill in this order)

| File | Required | What it does |
|------|----------|--------------|
| `school.csv` | Yes | School name + ID prefix for student numbers |
| `admin.csv` | Yes | Administrator login (forced password change on first login) |
| `terms.csv` | Yes | Academic terms |
| `classes.csv` | Yes | Classes + **class_number** (used in student IDs) |
| `subjects.csv` | Yes | Subjects offered |
| `students.csv` | Yes | Students + guardians (portal auto-created) |
| `teachers.csv` | Optional | Teachers (skip if adding via admin UI later) |

## Student ID format

`{id_prefix}-{class_number}-{sequence}`

Example: **DASE-7-001** = first student in class number **7** (e.g. Class 3).

- `id_prefix` comes from `school.csv` → `id_prefix` column (default: **DASE**)
- `class_number` comes from `classes.csv` → one number per class
- `sequence` auto-increments per class (001, 002, 003…)

## Class numbers (suggested)

| Class | class_number |
|-------|--------------|
| Nursery 1 | 1 |
| Nursery 2 | 2 |
| KG 1 | 3 |
| KG 2 | 4 |
| Class 1 | 5 |
| Class 2 | 6 |
| Class 3 | 7 |
| Class 4 | 8 |
| Class 5 | 9 |
| Class 6 | 10 |
| JHS 1 | 11 |
| JHS 2 | 12 |
| JHS 3 | 13 |

You can use your own numbering — just keep `class_number` unique in `classes.csv`.

## After import

1. Admin logs in with phone + password from `admin.csv`
2. They are **prompted to set a new password** on first login
3. Students use `/student/login` with Student ID + PIN (`1234` by default)
4. Parents use the mobile app with guardian phone from `students.csv`

## Environment

Optional in `backend/.env`:

```
SCHOOL_ID_PREFIX=DASE
DEFAULT_STUDENT_PIN=1234
```

## Re-importing

The import is **idempotent** where possible (skips existing phone numbers, updates class numbers). Delete specific rows from the DB if you need a clean re-import of one entity.
