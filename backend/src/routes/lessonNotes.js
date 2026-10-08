const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/db');

const router = Router();
router.use(authenticate);

const uploadDir = path.join(__dirname, '../../uploads/lesson-notes');
const allowedExtensions = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']);
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowedExtensions.has(path.extname(file.originalname).toLowerCase())) {
      return cb(new Error('Only PDF, Word, Excel, and PowerPoint files are allowed'));
    }
    cb(null, true);
  },
});

async function teacherClassIds(userId) {
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: {
      classTeacherOf: { select: { id: true } },
      subjectTeachers: { select: { classId: true } },
    },
  });
  if (!teacher) return [];
  return [...new Set([
    teacher.classTeacherOf?.id,
    ...teacher.subjectTeachers.map((assignment) => assignment.classId),
  ].filter(Boolean))];
}

function serialize(note) {
  return {
    id: note.id,
    title: note.title,
    fileName: note.fileName,
    fileType: note.fileType,
    fileSize: note.fileSize,
    createdAt: note.createdAt,
    class: note.class,
    uploader: note.uploader
      ? { firstName: note.uploader.firstName, lastName: note.uploader.lastName }
      : null,
  };
}

router.get('/', async (req, res) => {
  try {
    const classIds = req.user.role === 'ADMIN' ? null : await teacherClassIds(req.user.id);
    const classId = req.query.classId ? String(req.query.classId) : null;
    if (classIds && classId && !classIds.includes(classId)) {
      return res.status(403).json({ message: 'You do not have access to this class' });
    }
    const notes = await prisma.lessonNote.findMany({
      where: {
        ...(classId ? { classId } : {}),
        ...(classIds ? { classId: classId ? classId : { in: classIds } } : {}),
      },
      include: {
        class: { select: { id: true, name: true, level: true } },
        uploader: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ notes: notes.map(serialize) });
  } catch (err) {
    console.error('GET /lesson-notes', err);
    res.status(500).json({ message: 'Failed to fetch lesson notes' });
  }
});

router.post('/', authorize('ADMIN'), (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Upload failed' });
    next();
  });
}, async (req, res) => {
  try {
    const title = String(req.body.title || '').trim();
    const classId = String(req.body.classId || '').trim();
    if (!title || !classId || !req.file) {
      return res.status(400).json({ message: 'Title, class, and file are required' });
    }
    const cls = await prisma.class.findUnique({ where: { id: classId }, select: { id: true } });
    if (!cls) {
      fs.rmSync(req.file.path, { force: true });
      return res.status(404).json({ message: 'Class not found' });
    }
    const note = await prisma.lessonNote.create({
      data: {
        title,
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileType: req.file.mimetype || 'application/octet-stream',
        fileSize: req.file.size,
        classId,
        uploaderId: req.user.id,
      },
      include: {
        class: { select: { id: true, name: true, level: true } },
        uploader: { select: { firstName: true, lastName: true } },
      },
    });
    res.status(201).json({ note: serialize(note) });
  } catch (err) {
    if (req.file?.path) fs.rmSync(req.file.path, { force: true });
    console.error('POST /lesson-notes', err);
    res.status(500).json({ message: 'Failed to upload lesson note' });
  }
});

router.get('/:id/download', async (req, res) => {
  try {
    const note = await prisma.lessonNote.findUnique({ where: { id: req.params.id } });
    if (!note) return res.status(404).json({ message: 'Lesson note not found' });
    if (req.user.role !== 'ADMIN' && !(await teacherClassIds(req.user.id)).includes(note.classId)) {
      return res.status(403).json({ message: 'You do not have access to this lesson note' });
    }
    if (!fs.existsSync(note.filePath)) return res.status(404).json({ message: 'Lesson note file is missing' });
    res.download(note.filePath, note.fileName);
  } catch (err) {
    console.error('GET /lesson-notes/:id/download', err);
    res.status(500).json({ message: 'Failed to download lesson note' });
  }
});

router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  try {
    const note = await prisma.lessonNote.findUnique({ where: { id: req.params.id } });
    if (!note) return res.status(404).json({ message: 'Lesson note not found' });
    await prisma.lessonNote.delete({ where: { id: note.id } });
    fs.rmSync(note.filePath, { force: true });
    res.json({ message: 'Lesson note deleted' });
  } catch (err) {
    console.error('DELETE /lesson-notes/:id', err);
    res.status(500).json({ message: 'Failed to delete lesson note' });
  }
});

module.exports = router;
