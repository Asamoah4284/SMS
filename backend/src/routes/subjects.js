const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/db');

const router = Router();

// All routes require authentication
router.use(authenticate);

const handleValidationErrors = (req, res, next) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({ errors: errors.array() });
	}
	next();
};

async function getTeacherContext(userId) {
	return prisma.teacher.findUnique({
		where: { userId },
		include: {
			classTeacherOf: { select: { id: true } },
			subjectTeachers: { select: { classId: true, subjectId: true } },
		},
	});
}

// ─────────────────────────────────────────────────────────────────
// GET /subjects
// Optional query: classId
// ─────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
	try {
		const { classId } = req.query;

		if (!classId) {
			const subjects = await prisma.subject.findMany({
				orderBy: { name: 'asc' },
			});

			return res.json({
				subjects: subjects.map((s) => ({ id: s.id, name: s.name, code: s.code })),
			});
		}

		const classData = await prisma.class.findUnique({ where: { id: String(classId) } });
		if (!classData) return res.status(404).json({ error: 'Class not found' });

		const mappings = await prisma.subjectTeacher.findMany({
			where: { classId: String(classId) },
			include: {
				subject: { select: { id: true, name: true, code: true } },
				teacher: {
					select: {
						id: true,
						staffId: true,
						user: { select: { firstName: true, lastName: true } },
					},
				},
			},
			orderBy: [{ subject: { name: 'asc' } }],
		});

		return res.json({
			class: { id: classData.id, name: classData.name },
			subjects: mappings.map((m) => ({
				id: m.subject.id,
				name: m.subject.name,
				code: m.subject.code,
				teacher: {
					id: m.teacher.id,
					staffId: m.teacher.staffId,
					name: `${m.teacher.user.firstName} ${m.teacher.user.lastName}`,
				},
			})),
		});
	} catch (error) {
		console.error('Get subjects error:', error);
		return res.status(500).json({ error: 'Failed to fetch subjects' });
	}
});

// ─────────────────────────────────────────────────────────────────
// POST /subjects
// Create a subject and optionally assign it to a class/teacher.
// ─────────────────────────────────────────────────────────────────

router.post(
	'/',
	[
		body('name').notEmpty().withMessage('Subject name is required'),
		body('code').optional({ values: 'falsy' }).isString(),
		body('classId').optional({ values: 'falsy' }).isString(),
		body('teacherId').optional({ values: 'falsy' }).isString(),
	],
	handleValidationErrors,
	authorize('ADMIN', 'TEACHER'),
	async (req, res) => {
		try {
			const name = String(req.body.name).trim().replace(/\s+/g, ' ');
			const code = req.body.code ? String(req.body.code).trim().toUpperCase() : null;
			const classId = req.body.classId ? String(req.body.classId) : null;
			const teacherId = req.body.teacherId ? String(req.body.teacherId) : null;

			if (classId) {
				const cls = await prisma.class.findUnique({ where: { id: classId } });
				if (!cls) return res.status(404).json({ error: 'Class not found' });
			}

			let actingTeacher = null;
			if (req.user.role === 'TEACHER') {
				actingTeacher = await getTeacherContext(req.user.id);
				if (!actingTeacher) return res.status(404).json({ error: 'Teacher profile not found' });

				if (classId) {
					const classTeacherClassId = actingTeacher.classTeacherOf?.id;
					const assignedClassIds = new Set(actingTeacher.subjectTeachers.map((x) => x.classId));
					const canManageThisClass = classTeacherClassId === classId || assignedClassIds.has(classId);

					if (!canManageThisClass) {
						return res.status(403).json({ error: 'You are not assigned to this class' });
					}
				}
			}

			let subject = await prisma.subject.findFirst({
				where: { name: { equals: name, mode: 'insensitive' } },
			});

			if (!subject) {
				subject = await prisma.subject.create({
					data: { name, code },
				});
			} else if (code && subject.code !== code) {
				subject = await prisma.subject.update({
					where: { id: subject.id },
					data: { code },
				});
			}

			let mapped = null;

			if (classId) {
				const selectedTeacherId =
					req.user.role === 'ADMIN'
						? teacherId
						: actingTeacher.id;

				if (!selectedTeacherId) {
					return res.status(400).json({ error: 'teacherId is required when assigning subject to class' });
				}

				mapped = await prisma.subjectTeacher.upsert({
					where: {
						teacherId_subjectId_classId: {
							teacherId: selectedTeacherId,
							subjectId: subject.id,
							classId,
						},
					},
					update: {},
					create: {
						teacherId: selectedTeacherId,
						subjectId: subject.id,
						classId,
					},
					include: {
						class: { select: { id: true, name: true } },
						teacher: {
							select: {
								id: true,
								staffId: true,
								user: { select: { firstName: true, lastName: true } },
							},
						},
					},
				});
			}

			return res.status(201).json({
				message: mapped ? 'Subject created and assigned successfully' : 'Subject created successfully',
				subject: {
					id: subject.id,
					name: subject.name,
					code: subject.code,
				},
				assignment: mapped
					? {
							class: mapped.class,
							teacher: {
								id: mapped.teacher.id,
								staffId: mapped.teacher.staffId,
								name: `${mapped.teacher.user.firstName} ${mapped.teacher.user.lastName}`,
							},
						}
					: null,
			});
		} catch (error) {
			console.error('Create subject error:', error);
			return res.status(500).json({ error: 'Failed to create subject' });
		}
	}
);

module.exports = router;
