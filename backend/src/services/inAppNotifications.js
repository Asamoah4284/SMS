const prisma = require('../config/db');

/**
 * Create a single in-app notification for a staff dashboard user.
 */
async function createNotification({ userId, title, message, type }) {
  return prisma.notification.create({
    data: { userId, title, message, type },
  });
}

/**
 * Notify all active users with one of the given roles.
 */
async function notifyUsersByRole(roles, { title, message, type, excludeUserId }) {
  const users = await prisma.user.findMany({
    where: {
      role: { in: roles },
      isActive: true,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });

  if (users.length === 0) return 0;

  await prisma.notification.createMany({
    data: users.map((u) => ({ userId: u.id, title, message, type })),
  });

  return users.length;
}

/**
 * Notify users assigned to a class (class teacher + subject teachers) and all admins.
 */
async function notifyClassStaff(classId, { title, message, type, excludeUserId }) {
  const userIds = new Set();

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  });
  admins.forEach((a) => userIds.add(a.id));

  if (classId) {
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: {
        classTeacher: { select: { userId: true } },
        subjectTeachers: { select: { teacher: { select: { userId: true } } } },
      },
    });
    if (cls?.classTeacher?.userId) userIds.add(cls.classTeacher.userId);
    cls?.subjectTeachers?.forEach((st) => {
      if (st.teacher?.userId) userIds.add(st.teacher.userId);
    });
  }

  if (excludeUserId) userIds.delete(excludeUserId);
  if (userIds.size === 0) return 0;

  await prisma.notification.createMany({
    data: [...userIds].map((userId) => ({ userId, title, message, type })),
  });
  return userIds.size;
}

/**
 * Notify staff when a school announcement is published.
 */
async function notifyAnnouncement({ title, content, targetAudience, authorId }) {
  const body = content.length > 200 ? `${content.slice(0, 197)}...` : content;
  const notifTitle = title || 'New announcement';

  if (!['ALL', 'TEACHERS'].includes(targetAudience)) {
    return 0;
  }

  return notifyUsersByRole(['ADMIN', 'TEACHER'], {
    title: notifTitle,
    message: body,
    type: 'ANNOUNCEMENT',
    excludeUserId: authorId,
  });
}

/**
 * Notify admins when a teacher submits a leave request.
 */
async function notifyLeaveRequestSubmitted({ teacherName, type, startDate, endDate }) {
  const start = new Date(startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const end = new Date(endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const label = type.replace(/_/g, ' ').toLowerCase();

  return notifyUsersByRole(['ADMIN'], {
    title: 'New leave request',
    message: `${teacherName} requested ${label} (${start} – ${end}).`,
    type: 'LEAVE_REQUEST',
  });
}

/**
 * Notify a teacher when their leave request is approved or rejected.
 */
async function notifyLeaveRequestProcessed({ userId, status, adminNote }) {
  const approved = status === 'APPROVED';
  return createNotification({
    userId,
    title: approved ? 'Leave request approved' : 'Leave request declined',
    message: approved
      ? 'Your leave request has been approved.'
      : `Your leave request was declined.${adminNote ? ` Note: ${adminNote}` : ''}`,
    type: 'LEAVE_UPDATE',
  });
}

function formatGhs(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

/**
 * Notify staff when school fees are paid (online or manual).
 */
async function notifyFeePaymentReceived({
  studentName,
  amountGhs,
  method,
  classId,
  excludeUserId,
}) {
  const via = method ? ` via ${method}` : '';
  return notifyClassStaff(classId, {
    title: 'School fees payment',
    message: `${studentName || 'A student'} paid GH₵${formatGhs(amountGhs)}${via}.`,
    type: 'FEE_PAYMENT',
    excludeUserId,
  });
}

/**
 * Notify staff when a book payment is received (online or manual).
 */
async function notifyBookPaymentReceived({
  studentName,
  amountGhs,
  method,
  classId,
  excludeUserId,
}) {
  const via = method ? ` via ${method}` : '';
  return notifyClassStaff(classId, {
    title: 'Book payment',
    message: `${studentName || 'A student'} paid GH₵${formatGhs(amountGhs)} for books${via}.`,
    type: 'BOOK_PAYMENT',
    excludeUserId,
  });
}

/**
 * Notify admins when a new student is enrolled.
 */
async function notifyStudentEnrolled({ studentName, className, classId, excludeUserId }) {
  const where = className ? ` in ${className}` : '';
  return notifyClassStaff(classId, {
    title: 'New student enrolled',
    message: `${studentName || 'A student'} was added${where}.`,
    type: 'STUDENT_ENROLLED',
    excludeUserId,
  });
}

/**
 * Notify class staff when term results are published for parents.
 */
async function notifyResultsPublished({ className, termName, classId, excludeUserId }) {
  return notifyClassStaff(classId, {
    title: 'Results published',
    message: `${className || 'Class'} results for ${termName || 'the term'} are now visible to parents.`,
    type: 'RESULTS_PUBLISHED',
    excludeUserId,
  });
}

/**
 * Notify admins when a payout is requested from the school wallet.
 */
async function notifyPayoutRequestedInApp({ requesterName, amountGhs, payoutId }) {
  return notifyUsersByRole(['ADMIN'], {
    title: 'Payout request',
    message: `${requesterName || 'An admin'} requested GH₵${formatGhs(amountGhs)} (ref ${payoutId}).`,
    type: 'PAYOUT_REQUEST',
  });
}

/**
 * Notify admins when a student record is permanently deleted.
 */
async function notifyStudentDeleted({ studentName, studentId, className }) {
  const cls = className ? ` from ${className}` : '';
  return notifyUsersByRole(['ADMIN'], {
    title: 'Student removed',
    message: `${studentName || 'A student'} (${studentId || '—'}) was deleted${cls}.`,
    type: 'STUDENT_DELETED',
  });
}

module.exports = {
  createNotification,
  notifyUsersByRole,
  notifyClassStaff,
  notifyAnnouncement,
  notifyLeaveRequestSubmitted,
  notifyLeaveRequestProcessed,
  notifyFeePaymentReceived,
  notifyBookPaymentReceived,
  notifyStudentEnrolled,
  notifyResultsPublished,
  notifyPayoutRequestedInApp,
  notifyStudentDeleted,
};
