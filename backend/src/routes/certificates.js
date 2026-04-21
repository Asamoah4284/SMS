const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /templates - list certificate templates
router.get('/templates', authorize('ADMIN', 'TEACHER'), (req, res) => {
  const templates = [
    { id: 'completion', name: 'Course Completion' },
    { id: 'excellence', name: 'Academic Excellence' },
    { id: 'participation', name: 'Certificate of Participation' }
  ];
  res.json(templates);
});

// POST /generate - mock PDF generation using pdfkit
router.post('/generate', authorize('ADMIN', 'TEACHER'), async (req, res, next) => {
  try {
    const { templateId, studentName, courseName, issuedDate } = req.body;
    
    if (!templateId || !studentName) {
      return res.status(400).json({ message: 'templateId and studentName are required' });
    }

    let PDFDocument;
    try {
      PDFDocument = require('pdfkit');
    } catch (e) {
      return res.status(500).json({ 
        message: 'PDFKit is not installed. Please run: npm install pdfkit in the backend directory to enable this feature' 
      });
    }

    const doc = new PDFDocument({
      layout: 'landscape',
      size: 'A4',
    });

    const filename = `certificate_${Date.now()}.pdf`;
    const uploadDir = path.join(__dirname, '../../uploads');
    const filepath = path.join(uploadDir, filename);
    
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const writeStream = fs.createWriteStream(filepath);
    doc.pipe(writeStream);

    // Provide a simple design border
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();
    
    // Certificate Title
    doc.moveDown(2);
    doc.fontSize(40).text('CERTIFICATE', { align: 'center' });
    doc.moveDown(1);
    
    // Subtitle based on templateId
    let subtitle = 'OF ';
    if (templateId === 'completion') subtitle += 'COMPLETION';
    else if (templateId === 'excellence') subtitle += 'ACADEMIC EXCELLENCE';
    else subtitle += 'PARTICIPATION';
    
    doc.fontSize(25).text(subtitle, { align: 'center' });
    doc.moveDown(2);
    
    doc.fontSize(18).text('This certificate is proudly presented to', { align: 'center' });
    doc.moveDown(1);
    
    doc.fontSize(30).text(studentName, { align: 'center', underline: true });
    doc.moveDown(1);
    
    doc.fontSize(18).text(`For successfully completing ${courseName || 'the assigned coursework'}`, { align: 'center' });
    doc.moveDown(2);
    
    const displayDate = issuedDate || new Date().toLocaleDateString();
    doc.fontSize(14).text(`Date: ${displayDate}`, { align: 'center' });

    doc.end();

    writeStream.on('finish', () => {
      const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
      res.status(201).json({ 
        message: 'Certificate generated successfully',
        fileUrl,
        filename
      });
    });

    writeStream.on('error', (err) => {
      next(err);
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;