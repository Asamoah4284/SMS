'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await api.get<{ data: { isRead: boolean }[] } | { isRead: boolean }[]>('/notifications');
        const notifications: { isRead: boolean }[] = Array.isArray(res)
          ? res
          : (res as { data: { isRead: boolean }[] }).data ?? [];
        const unread = notifications.filter((n) => !n.isRead).length;
        setUnreadCount(unread);
      } catch (error) {
        console.error('Failed to fetch notifications', error);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const handleClick = async () => {
    if (unreadCount === 0) return;
    try {
      // Assuming a blanket endpoint to mark all as read or handling it on click
      await api.post('/notifications/mark-all-read', {});
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark notifications as read', error);
      // Optimistically clear it anyways
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
