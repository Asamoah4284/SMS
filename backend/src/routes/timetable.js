const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const prisma = require('../config/db');

const router = Router();

// All routes require authentication
router.use(authenticate);

const DAY_NAMES = {
	1: 'Monday',
	2: 'Tuesday',
	3: 'Wednesday',
	4: 'Thursday',
	5: 'Friday',
};

const handleValidationErrors = (req, res, next) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({ errors: errors.array() });
	}
	next();
};

async function getTeacherContext(userId) {
	const teacher = await prisma.teacher.findUnique({
		where: { userId },
		include: {
			classTeacherOf: { select: { id: true, name: true } },
			subjectTeachers: {
				include: {
					class: { select: { id: true, name: true } },
					subject: { select: { id: true, name: true } },
				},
			},
		},
	});

	if (!teacher) return null;

	const classTeacherClassIds = teacher.classTeacherOf ? [teacher.classTeacherOf.id] : [];
	const subjectClassIds = [...new Set(teacher.subjectTeachers.map((st) => st.classId))];

	return {
		teacher,
		classTeacherClassIds,
		subjectClassIds,
		allAccessibleClassIds: [...new Set([...classTeacherClassIds, ...subjectClassIds])],
	};
}

function normalizeSubjectName(name) {
	return String(name || '').trim().replace(/\s+/g, ' ');
}

function normalizeTime(value) {
	return String(value || '').trim();
}

// Check if two time ranges overlap
function timesOverlap(startA, endA, startB, endB) {
	return startA < endB && endA > startB;
}

// ─────────────────────────────────────────────────────────────────
// ENHANCED VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────

async function checkTeacherConflicts(teacherId, daysOfWeek, startTime, endTime, excludeClassId = null) {
	/**
	 * Detect if teacher has conflicting slots (same day, overlapping times across different classes).
	 * Returns array of conflicts or empty if none.
	 */
	const conflicts = [];

	for (const dayOfWeek of daysOfWeek) {
		const teacherSlots = await prisma.timetable.findMany({
			where: {
				dayOfWeek,
				subject: {
					subjectTeachers: {
						some: { teacherId },
					},
				},
			},
			include: {
				class: { select: { id: true, name: true } },
				subject: { select: { id: true, name: true } },
			},
		});

		for (const slot of teacherSlots) {
			if (excludeClassId && slot.classId === excludeClassId) continue;

			if (timesOverlap(startTime, endTime, slot.startTime, slot.endTime)) {
				conflicts.push({
					day: DAY_NAMES[dayOfWeek],
					class: slot.class.name,
					subject: slot.subject.name,
					time: `${slot.startTime}-${slot.endTime}`,
					requestedTime: `${startTime}-${endTime}`,
				});
			}
		}
	}

	return conflicts;
}

async function checkClassTimeOverlaps(classId, daysOfWeek, startTime, endTime, excludeSubjectId = null) {
	/**
	 * Detect if class already has a subject at overlapping times on these days.
	 * Returns array of conflicts or empty if none.
	 */
	const conflicts = [];

	for (const dayOfWeek of daysOfWeek) {
		const classSlots = await prisma.timetable.findMany({
			where: { classId, dayOfWeek },
			include: {
				subject: { select: { id: true, name: true } },
			},
		});

		for (const slot of classSlots) {
			if (excludeSubjectId && slot.subjectId === excludeSubjectId) continue;

			if (timesOverlap(startTime, endTime, slot.startTime, slot.endTime)) {
				conflicts.push({
					day: DAY_NAMES[dayOfWeek],
					subject: slot.subject.name,
					time: `${slot.startTime}-${slot.endTime}`,
					requestedTime: `${startTime}-${endTime}`,
				});
			}
		}
	}

	return conflicts;
}

// ─────────────────────────────────────────────────────────────────
// GET /timetable/context
// Returns role-aware context for timetable UI.
// ─────────────────────────────────────────────────────────────────

router.get('/context', async (req, res) => {
	try {
		// Only ADMIN and TEACHER roles can access timetable
		if (req.user.role === 'PARENT') {
			return res.status(403).json({ error: 'Parents cannot access timetable management' });
		}

		if (req.user.role === 'ADMIN') {
			const classes = await prisma.class.findMany({ orderBy: { name: 'asc' } });
			return res.json({
				role: 'ADMIN',
				classes: classes.map((c) => ({ id: c.id, name: c.name, canEdit: true })),
				classTeacherClasses: [],
				subjectAssignments: [],
			});
		}

		if (req.user.role !== 'TEACHER') {
			return res.status(403).json({ error: 'Only teachers and admins can access timetable tools' });
		}

		const ctx = await getTeacherContext(req.user.id);
		if (!ctx) return res.status(404).json({ error: 'Teacher profile not found' });

		const classes = await prisma.class.findMany({
			where: { id: { in: ctx.allAccessibleClassIds } },
			orderBy: { name: 'asc' },
		});

		const classTeacherSet = new Set(ctx.classTeacherClassIds);

		return res.json({
			role: 'TEACHER',
			teacherId: ctx.teacher.id,
			classes: classes.map((c) => ({ id: c.id, name: c.name, canEdit: classTeacherSet.has(c.id) })),
			classTeacherClasses: ctx.classTeacherClassIds,
			subjectAssignments: ctx.teacher.subjectTeachers.map((st) => ({
				classId: st.classId,
				className: st.class.name,
				subjectId: st.subjectId,
				subjectName: st.subject.name,
			})),
		});
	} catch (error) {
		console.error('Timetable context error:', error);
		return res.status(500).json({ error: 'Failed to load timetable context' });
	}
});

// ─────────────────────────────────────────────────────────────────
// GET /timetable/my-upcoming
// Teacher-only upcoming timetable (only subjects assigned to this teacher).
// ─────────────────────────────────────────────────────────────────

router.get('/my-upcoming', authorize('TEACHER'), async (req, res) => {
	try {
		const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
		const ctx = await getTeacherContext(req.user.id);
		if (!ctx) return res.status(404).json({ error: 'Teacher profile not found' });

		const slots = await prisma.timetable.findMany({
			where: {
				subject: {
					subjectTeachers: {
						some: {
							teacherId: ctx.teacher.id,
							classId: { in: ctx.allAccessibleClassIds },
						},
					},
				},
				classId: { in: ctx.allAccessibleClassIds },
			},
			include: {
				class: { select: { id: true, name: true } },
				subject: { select: { id: true, name: true, code: true } },
			},
			orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
			take: limit,
		});

		return res.json({
			entries: slots.map((s) => ({
				id: s.id,
				dayOfWeek: s.dayOfWeek,
				dayName: DAY_NAMES[s.dayOfWeek] || 'Unknown',
				startTime: s.startTime,
				endTime: s.endTime,
				class: s.class,
				subject: s.subject,
			})),
		});
	} catch (error) {
		console.error('My upcoming timetable error:', error);
		return res.status(500).json({ error: 'Failed to fetch upcoming timetable' });
	}
});

// ─────────────────────────────────────────────────────────────────
// GET /timetable/class/:classId
// Full class timetable (read-only for subject teachers).
// ─────────────────────────────────────────────────────────────────

router.get('/class/:classId', authorize('ADMIN', 'TEACHER'), async (req, res) => {
	try {
		const { classId } = req.params;
		const classData = await prisma.class.findUnique({ where: { id: classId } });
		if (!classData) return res.status(404).json({ error: 'Class not found' });

		let canEdit = req.user.role === 'ADMIN';

		if (req.user.role === 'TEACHER') {
			const ctx = await getTeacherContext(req.user.id);
			if (!ctx) return res.status(404).json({ error: 'Teacher profile not found' });

			if (!ctx.allAccessibleClassIds.includes(classId)) {
				return res.status(403).json({ error: 'You are not assigned to this class' });
			}

			canEdit = ctx.classTeacherClassIds.includes(classId);
		}

		const entries = await prisma.timetable.findMany({
			where: { classId },
			include: {
				subject: { select: { id: true, name: true, code: true } },
			},
			orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
		});

		return res.json({
			class: { id: classData.id, name: classData.name, level: classData.level, section: classData.section },
			canEdit,
			entries: entries.map((e) => ({
				id: e.id,
				dayOfWeek: e.dayOfWeek,
				dayName: DAY_NAMES[e.dayOfWeek] || 'Unknown',
				startTime: e.startTime,
				endTime: e.endTime,
				subject: e.subject,
			})),
		});
	} catch (error) {
		console.error('Class timetable error:', error);
		return res.status(500).json({ error: 'Failed to fetch class timetable' });
	}
});

// ─────────────────────────────────────────────────────────────────
// POST /timetable/slots
// Create timetable slots with role-aware behavior + enhanced validations.
// ─────────────────────────────────────────────────────────────────

router.post(
	'/slots',
	[
		body('classId').notEmpty().withMessage('Class is required'),
		body('subjectName').notEmpty().withMessage('Subject name is required'),
		body('startTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('startTime must be HH:MM'),
		body('endTime').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('endTime must be HH:MM'),
		body('daysOfWeek').isArray({ min: 1 }).withMessage('daysOfWeek must be a non-empty array'),
		body('daysOfWeek.*').isInt({ min: 1, max: 5 }).withMessage('Days must be between 1 and 5'),
	],
	handleValidationErrors,
	authorize('ADMIN', 'TEACHER'),
	async (req, res) => {
		try {
			const classId = String(req.body.classId);
			const subjectName = normalizeSubjectName(req.body.subjectName);
			const startTime = normalizeTime(req.body.startTime);
			const endTime = normalizeTime(req.body.endTime);
			const daysOfWeek = [...new Set(req.body.daysOfWeek.map((d) => Number(d)))].sort((a, b) => a - b);

			if (startTime >= endTime) {
				return res.status(400).json({ error: 'endTime must be after startTime' });
			}

			const classData = await prisma.class.findUnique({ where: { id: classId } });
			if (!classData) return res.status(404).json({ error: 'Class not found' });

			let actingTeacher = null;
			let isClassTeacher = false;
			let canAccessClass = req.user.role === 'ADMIN';

			if (req.user.role === 'TEACHER') {
				const ctx = await getTeacherContext(req.user.id);
				if (!ctx) return res.status(404).json({ error: 'Teacher profile not found' });

				actingTeacher = ctx.teacher;
				canAccessClass = ctx.allAccessibleClassIds.includes(classId);
				isClassTeacher = ctx.classTeacherClassIds.includes(classId);

				if (!canAccessClass) {
					return res.status(403).json({ error: 'You are not assigned to this class' });
				}
			}

			let subject = await prisma.subject.findFirst({
				where: { name: { equals: subjectName, mode: 'insensitive' } },
			});

			if (!subject) {
				subject = await prisma.subject.create({ data: { name: subjectName, code: null } });
			}

			const existingSubjectSlots = await prisma.timetable.findMany({
				where: { classId, subjectId: subject.id },
				orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
			});

			// Subject teacher flow: if class already has this subject scheduled, force reuse.
			if (req.user.role === 'TEACHER' && !isClassTeacher && existingSubjectSlots.length > 0) {
				return res.status(200).json({
					message: 'This subject already has a class timetable. Using class teacher schedule.',
					reusedExistingSchedule: true,
					entries: existingSubjectSlots.map((s) => ({
						id: s.id,
						dayOfWeek: s.dayOfWeek,
						dayName: DAY_NAMES[s.dayOfWeek] || 'Unknown',
						startTime: s.startTime,
						endTime: s.endTime,
						subject: { id: subject.id, name: subject.name, code: subject.code },
					})),
				});
			}

			// ─────────────────────────────────────────────────────────────────
			// ENHANCED VALIDATIONS (new logic)
			// ─────────────────────────────────────────────────────────────────

			// 1. Check for teacher conflicts (same teacher, overlapping times, different classes)
			if (actingTeacher) {
				const teacherConflicts = await checkTeacherConflicts(
					actingTeacher.id,
					daysOfWeek,
					startTime,
					endTime,
					classId // exclude this class from conflict check (updating same class is OK)
				);

				if (teacherConflicts.length > 0) {
					return res.status(409).json({
						error: 'Teacher conflict detected',
						message: `This teacher already has conflicting assignments:`,
						conflicts: teacherConflicts,
					});
				}
			}

			// 2. Check for class time overlaps (same class, overlapping times, any subject)
			const classConflicts = await checkClassTimeOverlaps(classId, daysOfWeek, startTime, endTime, subject.id);

			if (classConflicts.length > 0) {
				return res.status(409).json({
					error: 'Class time overlap detected',
					message: 'This class already has a conflicting subject at this time:',
					conflicts: classConflicts,
				});
			}

			// ─────────────────────────────────────────────────────────────────

			if (actingTeacher) {
				await prisma.subjectTeacher.upsert({
					where: {
						teacherId_subjectId_classId: {
							teacherId: actingTeacher.id,
							subjectId: subject.id,
							classId,
						},
					},
					update: {},
					create: {
						teacherId: actingTeacher.id,
						subjectId: subject.id,
						classId,
					},
				});
			}

			const createdOrUpdated = [];

			for (const dayOfWeek of daysOfWeek) {
				const saved = await prisma.timetable.upsert({
					where: {
						classId_dayOfWeek_startTime: {
							classId,
							dayOfWeek,
							startTime,
						},
					},
					update: {
						subjectId: subject.id,
						endTime,
					},
					create: {
						classId,
						subjectId: subject.id,
						dayOfWeek,
						startTime,
						endTime,
					},
					include: {
						subject: { select: { id: true, name: true, code: true } },
					},
				});

				createdOrUpdated.push({
					id: saved.id,
					dayOfWeek: saved.dayOfWeek,
					dayName: DAY_NAMES[saved.dayOfWeek] || 'Unknown',
					startTime: saved.startTime,
					endTime: saved.endTime,
					subject: saved.subject,
				});
			}

			return res.status(201).json({
				message: 'Timetable updated successfully',
				reusedExistingSchedule: false,
				entries: createdOrUpdated,
			});
		} catch (error) {
			console.error('Create timetable slots error:', error);
			return res.status(500).json({ error: 'Failed to save timetable slots' });
		}
	}
);

// ─────────────────────────────────────────────────────────────────
// POST /timetable/slots/copy
// Template/copy tool: duplicate all slots from one day to target days.
// Useful for "duplicate Monday → all weekdays" workflows.
// ─────────────────────────────────────────────────────────────────

router.post(
	'/slots/copy',
	[
		body('classId').notEmpty().withMessage('classId is required'),
		body('sourceDay').isInt({ min: 1, max: 5 }).withMessage('sourceDay must be 1-5'),
		body('targetDays')
			.isArray({ min: 1 })
			.withMessage('targetDays must be a non-empty array'),
		body('targetDays.*')
			.isInt({ min: 1, max: 5 })
			.withMessage('Each targetDay must be 1-5'),
	],
	handleValidationErrors,
	authorize('ADMIN', 'TEACHER'),
	async (req, res) => {
		try {
			const classId = String(req.body.classId);
			const sourceDay = Number(req.body.sourceDay);
			const targetDays = [...new Set(req.body.targetDays.map((d) => Number(d)))];

			if (targetDays.includes(sourceDay)) {
				return res.status(400).json({ error: 'targetDays cannot include sourceDay' });
			}

			const classData = await prisma.class.findUnique({ where: { id: classId } });
			if (!classData) return res.status(404).json({ error: 'Class not found' });

			// Permission check
			let canEdit = req.user.role === 'ADMIN';
			if (req.user.role === 'TEACHER') {
				const ctx = await getTeacherContext(req.user.id);
				if (!ctx) return res.status(404).json({ error: 'Teacher profile not found' });

				if (!ctx.classTeacherClassIds.includes(classId)) {
					return res.status(403).json({ error: 'Only class teacher can copy timetable' });
				}
				canEdit = true;
			}

			if (!canEdit) {
				return res.status(403).json({ error: 'You do not have permission to copy timetable' });
			}

			// Fetch all slots from sourceDay
			const sourceSlots = await prisma.timetable.findMany({
				where: { classId, dayOfWeek: sourceDay },
				include: { subject: { select: { id: true, name: true, code: true } } },
			});

			if (sourceSlots.length === 0) {
				return res.status(404).json({ error: `No timetable found for ${DAY_NAMES[sourceDay]} in this class` });
			}

			const copied = [];

			// Copy each slot to each target day
			for (const slot of sourceSlots) {
				for (const targetDay of targetDays) {
					// Check if target already exists, if so skip (non-destructive)
					const existing = await prisma.timetable.findFirst({
						where: {
							classId,
							dayOfWeek: targetDay,
							startTime: slot.startTime,
						},
					});

					if (existing) {
						continue; // Skip if already exists
					}

					const saved = await prisma.timetable.create({
						data: {
							classId,
							subjectId: slot.subjectId,
							dayOfWeek: targetDay,
							startTime: slot.startTime,
							endTime: slot.endTime,
						},
						include: { subject: { select: { id: true, name: true, code: true } } },
					});

					copied.push({
						id: saved.id,
						dayOfWeek: saved.dayOfWeek,
						dayName: DAY_NAMES[saved.dayOfWeek],
						startTime: saved.startTime,
						endTime: saved.endTime,
						subject: saved.subject,
					});
				}
			}

			return res.status(201).json({
				message: `Timetable copied from ${DAY_NAMES[sourceDay]} to ${targetDays.map((d) => DAY_NAMES[d]).join(', ')}`,
				copied: copied,
				skipped: sourceSlots.length * targetDays.length - copied.length,
			});
		} catch (error) {
			console.error('Copy timetable error:', error);
			return res.status(500).json({ error: 'Failed to copy timetable' });
		}
	}
);

module.exports = router;
