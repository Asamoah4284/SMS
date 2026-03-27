const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/db');

const router = Router();
router.use(authenticate);

// GET /terms — list all terms, current first
router.get('/', async (req, res) => {
  try {
    const terms = await prisma.term.findMany({
      orderBy: [{ isCurrent: 'desc' }, { year: 'desc' }, { name: 'asc' }],
    });
    res.json({ terms });
  } catch (err) {
    console.error('GET /terms', err);
    res.status(500).json({ message: 'Failed to fetch terms' });
  }
});

// GET /terms/current — shortcut for current term
router.get('/current', async (req, res) => {
  try {
    const term = await prisma.term.findFirst({ where: { isCurrent: true } });
    if (!term) return res.status(404).json({ message: 'No current term set' });
    res.json({ term });
  } catch (err) {
    console.error('GET /terms/current', err);
    res.status(500).json({ message: 'Failed to fetch current term' });
  }
});

// POST /terms — admin creates a term
router.post('/', authorize('ADMIN'), async (req, res) => {
  try {
    const { name, year, startDate, endDate, isCurrent } = req.body;
    if (!name || !year || !startDate || !endDate) {
      return res.status(400).json({ message: 'name, year, startDate, and endDate are required' });
    }

    // If setting as current, clear other current terms first
    if (isCurrent) {
      await prisma.term.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
    }

    const term = await prisma.term.create({
      data: {
        name,
        year: parseInt(year),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isCurrent: !!isCurrent,
      },
    });
    res.status(201).json({ message: 'Term created', term });
  } catch (err) {
    console.error('POST /terms', err);
    res.status(500).json({ message: 'Failed to create term' });
  }
});

// PUT /terms/:id — admin updates
router.put('/:id', authorize('ADMIN'), async (req, res) => {
  try {
    const { name, year, startDate, endDate, isCurrent } = req.body;

    if (isCurrent) {
      await prisma.term.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
    }

    const term = await prisma.term.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(year !== undefined && { year: parseInt(year) }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(isCurrent !== undefined && { isCurrent: !!isCurrent }),
      },
    });
    res.json({ message: 'Term updated', term });
  } catch (err) {
    console.error('PUT /terms/:id', err);
    res.status(500).json({ message: 'Failed to update term' });
  }
});

// DELETE /terms/:id — admin only; cannot delete if results exist
router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  try {
    const count = await prisma.result.count({ where: { termId: req.params.id } });
    if (count > 0) {
      return res.status(400).json({ message: 'Cannot delete term with existing results' });
    }
    await prisma.term.delete({ where: { id: req.params.id } });
    res.json({ message: 'Term deleted' });
  } catch (err) {
    console.error('DELETE /terms/:id', err);
    res.status(500).json({ message: 'Failed to delete term' });
  }
});

module.exports = router;
