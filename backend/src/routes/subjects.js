const { Router } = require('express');
const { body, query, validationResult } = require('express-validator');
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

/** Only admin or the class teacher for `classId` may manage that class’s subject list. */
async function assertClassTeacherOrAdmin(req, classId) {
	if (req.user.role === 'ADMIN') return { ok: true };
	if (req.user.role !== 'TEACHER') {
		return { ok: false, status: 403, error: 'Forbidden' };
	}
	const teacher = await getTeacherContext(req.user.id);
	if (!teacher) return { ok: false, status: 404, error: 'Teacher profile not found' };
	if (teacher.classTeacherOf?.id !== classId) {
		return {
			ok: false,
			status: 403,
			error: 'Only the class teacher or an admin can change subjects for this class',
		};
	}
	return { ok: true };
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

// ─────────────────────────────────────────────────────────────────
// PATCH /subjects/class-link
// Update subject name/code (global Subject row). Admin or class teacher only.
// ─────────────────────────────────────────────────────────────────

router.patch(
	'/class-link',
	[
		body('classId').notEmpty().withMessage('classId is required'),
		body('subjectId').notEmpty().withMessage('subjectId is required'),
		body('name').optional({ values: 'falsy' }).isString(),
		body('code').optional({ values: 'null' }).isString(),
	],
	handleValidationErrors,
	authorize('ADMIN', 'TEACHER'),
	async (req, res) => {
		try {
			const classId = String(req.body.classId);
			const subjectId = String(req.body.subjectId);
			const hasName = req.body.name !== undefined;
			const hasCode = req.body.code !== undefined;

			if (!hasName && !hasCode) {
				return res.status(400).json({ error: 'Provide name and/or code to update' });
			}

			const gate = await assertClassTeacherOrAdmin(req, classId);
			if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

			const link = await prisma.subjectTeacher.findFirst({
				where: { classId, subjectId },
				include: { subject: true },
			});
			if (!link) {
				return res.status(404).json({ error: 'This subject is not assigned to this class' });
			}

			const data = {};
			if (hasName) {
				const n = String(req.body.name ?? '').trim().replace(/\s+/g, ' ');
				if (!n) {
					return res.status(400).json({ error: 'name cannot be empty' });
				}
				data.name = n;
			}
			if (hasCode) {
				data.code =
					req.body.code === null || req.body.code === ''
						? null
						: String(req.body.code).trim().toUpperCase();
			}

			if (Object.keys(data).length === 0) {
				return res.status(400).json({ error: 'Nothing to update' });
			}

			try {
				const updated = await prisma.subject.update({
					where: { id: subjectId },
					data,
				});
				return res.json({
					message: 'Subject updated',
					subject: { id: updated.id, name: updated.name, code: updated.code },
				});
			} catch (e) {
				if (e && e.code === 'P2002') {
					return res.status(409).json({ error: 'A subject with that name already exists' });
				}
				throw e;
			}
		} catch (error) {
			console.error('Patch subject class link error:', error);
			return res.status(500).json({ error: 'Failed to update subject' });
		}
	}
);

// ─────────────────────────────────────────────────────────────────
// DELETE /subjects/class-link
// Remove subject from class (SubjectTeacher + class timetables for that subject).
// Blocked if assessments or term results exist for this class+subject.
// ─────────────────────────────────────────────────────────────────

router.delete(
	'/class-link',
	[
		query('classId').notEmpty().withMessage('classId is required'),
		query('subjectId').notEmpty().withMessage('subjectId is required'),
	],
	handleValidationErrors,
	authorize('ADMIN', 'TEACHER'),
	async (req, res) => {
		try {
			const classId = String(req.query.classId);
			const subjectId = String(req.query.subjectId);

			const gate = await assertClassTeacherOrAdmin(req, classId);
			if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

			const link = await prisma.subjectTeacher.findFirst({
				where: { classId, subjectId },
			});
			if (!link) {
				return res.status(404).json({ error: 'This subject is not assigned to this class' });
			}

			const assessmentCount = await prisma.assessment.count({
				where: { classId, subjectId },
			});
			if (assessmentCount > 0) {
				return res.status(409).json({
					error: 'Cannot remove subject',
					message:
						'This class has assessments linked to this subject. Remove or reassign those assessments first.',
				});
			}

			const studentsInClass = await prisma.student.findMany({
				where: { classId, isActive: true },
				select: { id: true },
			});
			const studentIds = studentsInClass.map((s) => s.id);
			if (studentIds.length > 0) {
				const resultCount = await prisma.result.count({
					where: {
						subjectId,
						studentId: { in: studentIds },
					},
				});
				if (resultCount > 0) {
					return res.status(409).json({
						error: 'Cannot remove subject',
						message:
							'Students in this class already have results for this subject. Contact an administrator if you need this changed.',
					});
				}
			}

			await prisma.$transaction([
				prisma.timetable.deleteMany({ where: { classId, subjectId } }),
				prisma.subjectTeacher.deleteMany({ where: { classId, subjectId } }),
			]);

			return res.json({ message: 'Subject removed from this class' });
		} catch (error) {
			console.error('Delete subject class link error:', error);
			return res.status(500).json({ error: 'Failed to remove subject from class' });
		}
	}
);

module.exports = router;
