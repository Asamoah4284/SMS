const { Expo } = require('expo-server-sdk');
const prisma = require('../config/db');

const expo = new Expo();

/**
 * Send push notification for a new school announcement.
 * Uses Expo Push API (delivers via FCM on Android and APNs on iOS when EAS is configured).
 */
async function sendAnnouncementPush({ title, content, targetAudience }) {
  // Parent app only registers tokens — skip teacher-only announcements
  if (targetAudience === 'TEACHERS') {
    return { sent: 0, skipped: 'teacher-only' };
  }

  const tokens = await prisma.pushToken.findMany({
    select: { token: true },
  });

  const valid = tokens.map((t) => t.token).filter((t) => Expo.isExpoPushToken(t));
  if (valid.length === 0) {
    return { sent: 0, skipped: 'no-tokens' };
  }

  const body = content.length > 180 ? `${content.slice(0, 177)}...` : content;
  const messages = valid.map((pushToken) => ({
    to: pushToken,
    sound: 'default',
    title: title || 'School announcement',
    body,
    data: { type: 'announcement', targetAudience },
    channelId: 'announcements',
  }));

  const chunks = expo.chunkPushNotifications(messages);
  let sent = 0;
  const errors = [];

  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      sent += receipts.filter((r) => r.status === 'ok').length;
      receipts.forEach((r, i) => {
        if (r.status === 'error') {
          errors.push({ token: chunk[i]?.to, message: r.message });
          if (r.details?.error === 'DeviceNotRegistered') {
            prisma.pushToken.deleteMany({ where: { token: chunk[i]?.to } }).catch(() => {});
          }
        }
      });
    } catch (err) {
      console.error('Expo push chunk error:', err);
      errors.push({ message: err.message });
    }
  }

  if (errors.length) {
    console.warn('Push delivery errors:', errors.slice(0, 5));
  }

  return { sent, total: valid.length, errors: errors.length };
}

/**
 * Push notification for a new school calendar event (all registered parent devices).
 */
async function sendSchoolEventPush({ title, body, eventId, eventDate }) {
  const tokens = await prisma.pushToken.findMany({ select: { token: true } });
  const valid = tokens.map((t) => t.token).filter((t) => Expo.isExpoPushToken(t));
  if (valid.length === 0) return { sent: 0, skipped: 'no-tokens' };

  const messages = valid.map((pushToken) => ({
    to: pushToken,
    sound: 'default',
    title: title || 'Upcoming school event',
    body: body?.length > 180 ? `${body.slice(0, 177)}...` : body,
    data: { type: 'school_event', eventId, eventDate },
    channelId: 'announcements',
  }));

  const chunks = expo.chunkPushNotifications(messages);
  let sent = 0;
  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      sent += receipts.filter((r) => r.status === 'ok').length;
    } catch (err) {
      console.error('Expo school event push error:', err);
    }
  }
  return { sent, total: valid.length };
}

module.exports = { sendAnnouncementPush, sendSchoolEventPush };
