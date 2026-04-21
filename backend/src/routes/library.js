const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = Router();
router.use(authenticate);

// Setup multer for File Uploads to local disk storage
const uploadDir = path.join(__dirname, '../../uploads');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique name keeping the original extension
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// GET / - list digital materials (library)
router.get('/', async (req, res, next) => {
  try {
    const { classId, subjectId } = req.query;
    
    const whereClause = {};
    if (classId) whereClause.classId = classId;
    if (subjectId) whereClause.subjectId = subjectId;

    const materials = await prisma.digitalMaterial.findMany({
      where: whereClause,
      include: {
        uploader: { select: { name: true, role: true } },
        class: { select: { className: true } },
        subject: { select: { subjectName: true } }
      },
      orderBy: { id: 'desc' }
    });

    res.json(materials);
  } catch (err) {
    next(err);
  }
});

// POST / - upload material (Admin or Teacher only)
router.post('/', authorize('ADMIN', 'TEACHER'), upload.single('file'), async (req, res, next) => {
  try {
    const { title, description, classId, subjectId } = req.body;
    
    if (!title || !req.file) {
      return res.status(400).json({ message: 'Title and file are required' });
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    const material = await prisma.digitalMaterial.create({
      data: {
        title,
        description: description || null,
        fileUrl,
        fileType: req.file.mimetype,
        uploaderId: req.user.id,
        classId: classId || null,
        subjectId: subjectId || null
      }
    });

    res.status(201).json(material);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - delete specific material
router.delete('/:id', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const material = await prisma.digitalMaterial.findUnique({
      where: { id }
    });
    
    if (!material) {
      return res.status(404).json({ message: 'Material not found' });
    }

    // Teachers can only delete their own materials
    if (req.user.role === 'TEACHER' && material.uploaderId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied: can only delete your own materials' });
    }

    await prisma.digitalMaterial.delete({
      where: { id }
    });
    
    // Remove the physical file if it's stored locally
    const filenameParts = material.fileUrl.split('/uploads/');
    if (filenameParts.length > 1) {
      const filename = filenameParts[1];
      const filepath = path.join(uploadDir, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }

    res.json({ message: 'Material deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;