# Phase 4 Plan: Student Management + Bulk Upload

## Overview
Admin + Teachers can manage students in their classes via UI or CSV bulk upload.

---

## Backend Routes (`/students`)

### 1. POST `/students` (Admin + Teacher)
**Add single student to class**
```json
{
  "firstName": "Ama",
  "lastName": "Boateng",
  "dateOfBirth": "2015-06-15",
  "parentName": "Joseph Boateng",
  "parentPhone": "0241234567",
  "address": "Accra, Ghana",
  "classId": "class_id_here"
}
```
- Validates phone (Ghana format)
- Generates studentId: `STM-2025-001` (auto-increment per year)
- Teachers can only add to own class (if class teacher)
- Admins can add to any class

### 2. POST `/students/bulk-upload` (Admin + Teacher)
**Upload CSV with multiple students**
```
CSV Format:
firstName,lastName,dateOfBirth,parentName,parentPhone,address
Ama,Boateng,2015-06-15,Joseph Boateng,0241234567,Accra
Kwasi,Mensah,2015-08-22,Mary Mensah,0251234567,Tema
```
- Validates each row
- Returns: success count + error details (line numbers)
- All-or-nothing: if validation fails, nothing inserted
- Upload to class selected on form

### 3. GET `/students` (All roles)
**List students (paginated, filterable)**
```
?classId=X&searchTerm=ama&page=1&limit=50
```
- Returns: id, name, age, class, parentPhone, dateOfBirth
- Admin sees all students
- Teachers see only their class students

### 4. GET `/students/:id` (All roles)
**Student detail**
- Name, age, class, parent info
- Attendance summary
- Grades (when results added)
- Fee payment status

### 5. PUT `/students/:id` (Admin + Teacher)
**Update student**
- Name, DOB, parent info, address
- Teachers can only update own class students

### 6. DELETE `/students/:id` (Admin only)
**Remove student**
- Soft delete? Or check attendances/results first
- Recommend: mark inactive instead of hard delete

---

## Frontend Pages

### 1. `/students` - Student List
**Features:**
- Table: Name, Class, Age, Parent Phone, Actions
- Filter by class (dropdown)
- Search by name
- Bulk action: Mark absent, assign fee
- Add student button (→ `/students/new`)
- Bulk upload button (→ `/students/bulk-upload`)

### 2. `/students/new` - Add Single Student
**Form:**
- First + Last name
- Date of birth (picker)
- Class dropdown
- Parent name, phone, address
- Submit → POST /students

### 3. `/students/bulk-upload` - CSV Import
**Features:**
- Select class (required)
- Download template CSV
- Upload file (validate before sending)
- Show preview: rows to insert
- Error handling: show which rows failed (with reasons)
- Confirm → POST /students/bulk-upload

### 4. `/students/[id]` - Student Detail
**Sections:**
- Header: Name, age, class, student ID
- Personal info: DOB, parent contact, address
- Attendance: Present %, absent count this term
- Results: Grades by subject (when added)
- Fees: Payment status (when added)

---

## Database Updates

### Student Model Updates
```prisma
model Student {
  id          String    @id @default(cuid())
  studentId   String    @unique            // STM-2025-001, auto
  firstName   String
  lastName    String
  dateOfBirth DateTime?
  gender      Gender?
  address     String?
  
  parentName  String?                      // NEW
  parentPhone String?                      // NEW (for quick contact)
  
  classId     String
  class       Class     @relation(fields: [classId], references: [id])
  
  parentId    String?   @unique            // Optional: link to Parent user
  parent      Parent?   @relation(fields: [parentId], references: [id])
  
  isActive    Boolean   @default(true)     // Soft delete
  enrolledAt  DateTime  @default(now())
  
  attendances Attendance[]
  results     Result[]
  feePayments FeePayment[]
  
  @@map("students")
}
```

### Add Index for Performance
```prisma
@@index([classId])
@@index([parentPhone])
```

---

## CSV Template

**`frontend/public/student-template.csv`**
```csv
firstName,lastName,dateOfBirth,parentName,parentPhone,address
Ama,Boateng,2015-06-15,Joseph Boateng,0241234567,Accra
Kwasi,Mensah,2015-08-22,Mary Mensah,0251234567,Tema
```

**Download link:** `/classes/[id]` → "Download CSV Template"

**Validation Rules:**
- firstName, lastName required
- dateOfBirth: YYYY-MM-DD format, past date
- parentPhone: Ghana format or empty
- Max 500 rows per upload
- Duplicate detection: if (firstName, lastName, classId) exists, skip

---

## Implementation Order

1. **Backend**
   - Update Prisma (parentName, parentPhone, isActive fields)
   - POST /students (single)
   - POST /students/bulk-upload (CSV)
   - GET /students (list + filter)
   - GET /students/:id (detail)
   - PUT /students/:id (update)
   - DELETE /students/:id (delete/deactivate)

2. **Frontend**
   - Create StudentList page (table + filters)
   - Create StudentForm (single add)
   - Create BulkUpload page (CSV + preview)
   - Create StudentDetail page
   - Add to class detail view

3. **Utilities**
   - CSV parser (Parse CSV → validate → return rows)
   - Student ID generator (auto-increment per year)
   - Age calculator (already have)

---

## Key Decisions

### Student ID Generation
**Format:** `STM-YYYY-NNN`
- STM = prefix
- YYYY = current academic year
- NNN = auto-increment per class per year (001, 002, ..., 999)
- Example: `STM-2025-042` (42nd student in 2025)

**Or simpler:** `STM-2025-<uuid-short>` (non-sequential but unique)

### CSV Parsing
- Use **Papa Parse** library (npm install papaparse)
- Validate before upload
- Show preview table before confirmation
- Error report: line numbers + specific field errors

### Bulk Upload Strategy
**Option A: All-or-Nothing** (safer)
- Validate all rows
- If any error, show errors, don't insert anything
- User fixes CSV, re-uploads

**Option B: Partial Success** (more lenient)
- Insert valid rows
- Report which rows failed
- User can fix those separately

**Recommendation:** Option A for data integrity

### Teacher Permissions
- Admin: Add students to any class
- Teacher (class teacher): Only add to own class
- Teacher (subject teacher): Cannot add students

---

## Utilities Needed

### `backend/src/utils/studentId.js`
```javascript
// Generate next student ID for a class in given year
async function generateNextStudentId(classId, year = new Date().getFullYear()) {
  const count = await prisma.student.count({
    where: {
      classId,
      enrolledAt: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    },
  });
  
  const nextNum = String(count + 1).padStart(3, '0');
  return `STM-${year}-${nextNum}`;
}
```

### `backend/src/utils/csvParser.js`
```javascript
// Parse CSV + validate student fields
function parseStudentCSV(csvText) {
  // Parse rows
  // Map to { firstName, lastName, ... }
  // Validate each: phone format, DOB format, required fields
  // Return: { valid: [], errors: [{row, field, message}] }
}
```

### `frontend/lib/csv.ts`
```typescript
// Client-side: preview CSV before upload
export function parseCSV(file: File): Promise<StudentRow[]>
export function downloadTemplate(): void  // Trigger download
```

---

## Testing Checklist

- [ ] Add single student → appears in class
- [ ] Upload valid CSV (5 rows) → all inserted
- [ ] Upload CSV with blank firstName → rejected, show error
- [ ] Upload CSV with invalid phone → rejected
- [ ] Upload CSV with future DOB → rejected
- [ ] Upload CSV with duplicate → skip duplicate, insert others
- [ ] Filter students by class
- [ ] Search students by name
- [ ] View student detail (age auto-calculated)
- [ ] Teacher can add to own class only
- [ ] Admin can add to any class

---

## Dependencies to Install

```bash
npm install papaparse
npm install --save-dev @types/papaparse
```

---

## Timeline Estimate

**~2-3 days** (1 person)
- Backend routes: 6-8 hours
- Frontend pages: 6-8 hours
- CSV parsing + validation: 2-3 hours
- Testing: 2-3 hours

---

## Next Phases (5, 6, 7)

After Phase 4 completes, roadmap:

**Phase 5: Attendance Tracking**
- Daily attendance marking (teacher selects students → mark present/absent/late)
- Summary dashboard (attendance %, trends)
- Auto-log teacher check-in on login (already done)

**Phase 6: Exam Results + Grading**
- Teacher uploads class scores (CSV or UI)
- GES grading applied (A1-F9)
- Results report per student
- Promotion logic (pass/fail based on aggregate)

**Phase 7: Fee Management**
- Fee structure setup (per class level)
- Manual payment recording (cash, momo, bank)
- Payment status dashboard (fully paid, half, pending)
- Payment receipts

---

Good to proceed with Phase 4? 🚀
