'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      const token = getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const notifications = await api.get<{ isRead: boolean }[]>('/notifications', token);
        const unread = notifications.filter((n) => !n.isRead).length;
        setUnreadCount(unread);
      } catch {
        // Silent fail — bell is non-critical; avoid noisy dev overlay on auth errors
        setUnreadCount(0);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const handleClick = async () => {
    if (unreadCount === 0) return;
    const token = getAccessToken();
    if (!token) return;

    try {
      await api.put('/notifications/read-all', {}, token);
      setUnreadCount(0);
    } catch {
      setUnreadCount(0);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="relative text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-full hover:bg-gray-100"
      aria-label="Notifications"
    >
      <Bell className="w-5 h-5" />
      {!loading && unreadCount > 0 && (
        <span className="absolute top-1.5 right-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
