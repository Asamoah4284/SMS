const { Router } = require('express');

const authRoutes = require('./auth');
const schoolRoutes = require('./schools');
const studentRoutes = require('./students');
const teacherRoutes = require('./teachers');
const classRoutes = require('./classes');
const parentRoutes = require('./parents');
const subjectRoutes = require('./subjects');
const attendanceRoutes = require('./attendance');
const resultRoutes = require('./results');
const feeRoutes = require('./fees');
const timetableRoutes = require('./timetable');
const announcementRoutes = require('./announcements');
const permissionRoutes = require('./permissions');
const reportRoutes = require('./reports');
const termRoutes = require('./terms');
const portalRoutes = require('./portal');
const notificationRoutes = require('./notifications');
const libraryRoutes = require('./library');
const certificateRoutes = require('./certificates');

const router = Router();

router.use('/auth', authRoutes);
router.use('/schools', schoolRoutes);
router.use('/students', studentRoutes);
router.use('/teachers', teacherRoutes);
router.use('/classes', classRoutes);
router.use('/parents', parentRoutes);
router.use('/subjects', subjectRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/results', resultRoutes);
router.use('/fees', feeRoutes);
router.use('/timetable', timetableRoutes);
router.use('/announcements', announcementRoutes);
router.use('/permissions', permissionRoutes);
router.use('/reports', reportRoutes);
router.use('/terms', termRoutes);
router.use('/portal', portalRoutes);
router.use('/notifications', notificationRoutes);
router.use('/library', libraryRoutes);
router.use('/certificates', certificateRoutes);

module.exports = router;
