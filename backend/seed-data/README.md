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

Optional student columns (`gender`, `date_of_birth`, `address`, `parent_name`, `parent_phone`) can be left blank — the import fills defaults you can edit later in the dashboard:

| Column | Default when empty |
|--------|-------------------|
| `gender` | `FEMALE` (override with `DEFAULT_STUDENT_GENDER=MALE` in `.env`) |
| `date_of_birth` | (none) |
| `address` | (none) |
| `parent_name` | `Guardian (update in dashboard)` |
| `parent_phone` | (none) |

| `teachers.csv` | Optional | Teachers (skip if adding via admin UI later) |

## Student ID format

`{id_prefix}-{class_code}-{register_number}`

Examples:

| Class | Code | Example ID |
|-------|------|----------------|
| Creche | `CR` | `DASE-CR-001` |
| Nursery 1 | `N1` | `DASE-N1-003` |
| KG 2 | `KG2` | `DASE-KG2-012` |
| Year 8 | `Y8` | `DASE-Y8-001` |
| Basic 4 (GES) | `B4` | `DASE-B4-005` |
| JHS 2 | `J2` | `DASE-J2-002` |

- `id_prefix` comes from `school.csv` (default **DASE**)
- `class_code` comes from the class `level` in `classes.csv`
- `register_number` is **001, 002, 003…** by **alphabetical register order** (surname A→Z, then first name)

Re-align all IDs after bulk changes:

```bash
npm run students:renumber-ids
```

## Class levels (`level` column)

Use one of these exact values in `classes.csv`:

| Level code | Typical name |
|------------|----------------|
| `CRECHE` | Creche |
| `NURSERY_1` | Nursery 1 |
| `NURSERY_2` | Nursery 2 |
| `KG_1` | KG 1 |
| `KG_2` | KG 2 |
| `YEAR_1` … `YEAR_8` | Year 1 … Year 8 |
| `BASIC_1` … `BASIC_6` | Class 1 … Class 6 (GES) |
| `JHS_1` … `JHS_3` | JHS 1 … JHS 3 |

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
DEFAULT_STUDENT_GENDER=FEMALE
```

## Re-importing

The import is **idempotent** where possible (skips existing phone numbers, updates class numbers). Delete specific rows from the DB if you need a clean re-import of one entity.
