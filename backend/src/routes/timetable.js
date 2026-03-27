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

function timeToMinutes(hhmm) {
	const parts = String(hhmm || '').split(':');
	if (parts.length !== 2) return NaN;
	const h = Number(parts[0]);
	const m = Number(parts[1]);
	if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
	return h * 60 + m;
}

function minutesToTime(total) {
	const t = ((total % 1440) + 1440) % 1440;
	const hh = Math.floor(t / 60);
	const mm = t % 60;
	return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function addMinutesToTime(hhmm, deltaMins) {
	return minutesToTime(timeToMinutes(hhmm) + Number(deltaMins));
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

		const teacherNameBySubjectClass = new Map();
		if (slots.length > 0) {
			const classIds = [...new Set(slots.map((s) => s.classId))];
			const subjectIds = [...new Set(slots.map((s) => s.subjectId))];
			const links = await prisma.subjectTeacher.findMany({
				where: { classId: { in: classIds }, subjectId: { in: subjectIds } },
				include: {
					teacher: {
						include: {
							user: { select: { firstName: true, lastName: true } },
						},
					},
				},
			});
			for (const st of links) {
				const u = st.teacher.user;
				const full = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
				if (!full) continue;
				const k = `${st.classId}\t${st.subjectId}`;
				const prev = teacherNameBySubjectClass.get(k);
				teacherNameBySubjectClass.set(k, prev ? `${prev}, ${full}` : full);
			}
		}

		return res.json({
			entries: slots.map((s) => ({
				id: s.id,
				dayOfWeek: s.dayOfWeek,
				dayName: DAY_NAMES[s.dayOfWeek] || 'Unknown',
				startTime: s.startTime,
				endTime: s.endTime,
				class: s.class,
				subject: s.subject,
				teacherName: teacherNameBySubjectClass.get(`${s.classId}\t${s.subjectId}`) ?? null,
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

		const subjectIds = [...new Set(entries.map((e) => e.subjectId))];
		const teacherNameBySubjectId = new Map();
		if (subjectIds.length > 0) {
			const links = await prisma.subjectTeacher.findMany({
				where: { classId, subjectId: { in: subjectIds } },
				include: {
					teacher: {
						include: {
							user: { select: { firstName: true, lastName: true } },
						},
					},
				},
			});
			for (const st of links) {
				const u = st.teacher.user;
				const full = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
				if (!full) continue;
				const prev = teacherNameBySubjectId.get(st.subjectId);
				teacherNameBySubjectId.set(st.subjectId, prev ? `${prev}, ${full}` : full);
			}
		}

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
				teacherName: teacherNameBySubjectId.get(e.subjectId) ?? null,
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

			if (req.user.role === 'TEACHER' && isClassTeacher) {
				if (!subject) {
					return res.status(400).json({
						error: 'Subject not found',
						message: 'Add this subject to the class under class settings before it can appear on the timetable.',
					});
				}
				const offered = await prisma.subjectTeacher.findFirst({
					where: { classId, subjectId: subject.id },
				});
				if (!offered) {
					return res.status(400).json({
						error: 'Subject not offered for this class',
						message: 'Only subjects already assigned to this class can be added to the timetable.',
					});
				}
			} else if (!subject) {
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
// POST /timetable/generate
// Build a full weekly timetable from day start, period length, optional breaks,
// and subjects assigned to the class (SubjectTeacher). Admin or class teacher only.
// ─────────────────────────────────────────────────────────────────

router.post('/generate', authorize('ADMIN', 'TEACHER'), async (req, res) => {
	try {
		const classId = String(req.body.classId || '').trim();
		const schoolStart = normalizeTime(req.body.schoolStart);
		const periodsPerDay = Number(req.body.periodsPerDay);
		const periodDurationMinutes = Number(req.body.periodDurationMinutes);
		const rawDays = Array.isArray(req.body.daysOfWeek) ? req.body.daysOfWeek : [1, 2, 3, 4, 5];
		const daysOfWeek = [...new Set(rawDays.map((d) => Number(d)))].filter((d) => d >= 1 && d <= 5).sort((a, b) => a - b);
		const rawBreaks = Array.isArray(req.body.breaks) ? req.body.breaks : [];
		const subjectIdsOrder = Array.isArray(req.body.subjectIds) ? req.body.subjectIds.map((x) => String(x)) : null;

		if (!classId) {
			return res.status(400).json({ error: 'classId is required' });
		}
		if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(schoolStart)) {
			return res.status(400).json({ error: 'schoolStart must be HH:MM' });
		}
		if (!Number.isFinite(periodsPerDay) || periodsPerDay < 1 || periodsPerDay > 14) {
			return res.status(400).json({ error: 'periodsPerDay must be between 1 and 14' });
		}
		if (!Number.isFinite(periodDurationMinutes) || periodDurationMinutes < 5 || periodDurationMinutes > 120) {
			return res.status(400).json({ error: 'periodDurationMinutes must be between 5 and 120' });
		}
		if (daysOfWeek.length === 0) {
			return res.status(400).json({ error: 'daysOfWeek must include at least one weekday (1–5)' });
		}

		const breaks = [];
		for (const b of rawBreaks) {
			if (!b || typeof b !== 'object') continue;
			const ap = Number(b.afterPeriod);
			const mins = Number(b.minutes);
			if (!Number.isFinite(ap) || ap < 1 || ap >= periodsPerDay) continue;
			if (!Number.isFinite(mins) || mins < 0 || mins > 120) continue;
			breaks.push({ afterPeriod: ap, minutes: mins });
		}
		breaks.sort((a, b) => a.afterPeriod - b.afterPeriod);

		const classData = await prisma.class.findUnique({ where: { id: classId } });
		if (!classData) return res.status(404).json({ error: 'Class not found' });

		let canAccessClass = req.user.role === 'ADMIN';
		let isClassTeacher = false;

		if (req.user.role === 'TEACHER') {
			const ctx = await getTeacherContext(req.user.id);
			if (!ctx) return res.status(404).json({ error: 'Teacher profile not found' });

			canAccessClass = ctx.allAccessibleClassIds.includes(classId);
			isClassTeacher = ctx.classTeacherClassIds.includes(classId);

			if (!canAccessClass) {
				return res.status(403).json({ error: 'You are not assigned to this class' });
			}
			if (!isClassTeacher) {
				return res.status(403).json({
					error: 'Only the class teacher or an admin can generate the full class timetable',
				});
			}
		}

		const subjectMappings = await prisma.subjectTeacher.findMany({
			where: { classId },
			include: {
				subject: { select: { id: true, name: true, code: true } },
			},
			orderBy: [{ subject: { name: 'asc' } }],
		});

		if (subjectMappings.length === 0) {
			return res.status(400).json({
				error: 'No subjects for this class',
				message: 'Add at least one subject to the class before generating a timetable.',
			});
		}

		let orderedSubjectIds = subjectMappings.map((m) => m.subjectId);
		if (subjectIdsOrder && subjectIdsOrder.length > 0) {
			const allowed = new Set(orderedSubjectIds);
			const filtered = subjectIdsOrder.filter((id) => allowed.has(id));
			if (filtered.length === 0) {
				return res.status(400).json({ error: 'subjectIds must list subjects that belong to this class' });
			}
			orderedSubjectIds = filtered;
		}

		const teacherBySubject = new Map(subjectMappings.map((m) => [m.subjectId, m.teacherId]));

		const breakAfter = new Map(breaks.map((b) => [b.afterPeriod, b.minutes]));

		const planned = [];
		for (const dayOfWeek of daysOfWeek) {
			let current = schoolStart;
			for (let periodIndex = 1; periodIndex <= periodsPerDay; periodIndex += 1) {
				const subjectId = orderedSubjectIds[(periodIndex - 1) % orderedSubjectIds.length];
				const startTime = current;
				const endTime = addMinutesToTime(startTime, periodDurationMinutes);
				if (timeToMinutes(endTime) > 24 * 60) {
					return res.status(400).json({
						error: 'School day extends past midnight',
						message: 'Reduce periods, shorten period length, or start earlier.',
					});
				}
				planned.push({ dayOfWeek, startTime, endTime, subjectId });
				current = endTime;
				const br = breakAfter.get(periodIndex);
				if (br !== undefined) {
					current = addMinutesToTime(current, br);
					if (timeToMinutes(current) > 24 * 60) {
						return res.status(400).json({
							error: 'School day extends past midnight',
							message: 'Reduce break lengths or fewer periods.',
						});
					}
				}
			}
		}

		for (const slot of planned) {
			const tid = teacherBySubject.get(slot.subjectId);
			if (!tid) {
				return res.status(500).json({ error: 'Missing subject assignment for class' });
			}
			const conflicts = await checkTeacherConflicts(tid, [slot.dayOfWeek], slot.startTime, slot.endTime, classId);
			if (conflicts.length > 0) {
				const sub = subjectMappings.find((m) => m.subjectId === slot.subjectId)?.subject?.name || 'Subject';
				return res.status(409).json({
					error: 'Teacher schedule conflict',
					message: `Cannot place ${sub} at ${slot.startTime}–${slot.endTime} (${DAY_NAMES[slot.dayOfWeek]})`,
					conflicts,
				});
			}
		}

		const created = await prisma.$transaction(async (tx) => {
			await tx.timetable.deleteMany({ where: { classId } });

			const out = [];
			for (const slot of planned) {
				const saved = await tx.timetable.create({
					data: {
						classId,
						subjectId: slot.subjectId,
						dayOfWeek: slot.dayOfWeek,
						startTime: slot.startTime,
						endTime: slot.endTime,
					},
					include: {
						subject: { select: { id: true, name: true, code: true } },
					},
				});
				out.push({
					id: saved.id,
					dayOfWeek: saved.dayOfWeek,
					dayName: DAY_NAMES[saved.dayOfWeek] || 'Unknown',
					startTime: saved.startTime,
					endTime: saved.endTime,
					subject: saved.subject,
				});
			}
			return out;
		});

		return res.status(201).json({
			message: `Generated ${created.length} timetable slot(s)`,
			entries: created,
		});
	} catch (error) {
		console.error('Generate timetable error:', error);
		return res.status(500).json({ error: 'Failed to generate timetable' });
	}
});

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
