'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  href?: string;
  read: boolean;
  timestamp: Date;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const POLL_INTERVAL = 15_000; // 15 seconds
const PROVIDER_ROLES = ['provider', 'tow_operator'];

function requestBrowserPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showBrowserNotification(title: string, body: string) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/logo.png' });
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const knownJobIds = useRef<Set<number>>(new Set());
  const isProvider = user && PROVIDER_ROLES.includes(user.role);

  useEffect(() => {
    if (isProvider) requestBrowserPermission();
  }, [isProvider]);

  const pollJobs = useCallback(async () => {
    if (!isProvider) return;
    try {
      const jobs = await api.get<{ assignment_id: number; service_type_name?: string; current_status?: string }[]>('/providers/jobs');
      jobs.forEach((job) => {
        if (!knownJobIds.current.has(job.assignment_id)) {
          knownJobIds.current.add(job.assignment_id);
          // First load — just seed the set without notifying
        }
      });
    } catch {
      // silently ignore network errors
    }
  }, [isProvider]);

  // Initial seed — populate known IDs without notifications
  useEffect(() => {
    if (!isProvider) return;
    api.get<{ assignment_id: number }[]>('/providers/jobs')
      .then((jobs) => jobs.forEach((j) => knownJobIds.current.add(j.assignment_id)))
      .catch(() => {});
  }, [isProvider]);

  // Polling for new jobs
  useEffect(() => {
    if (!isProvider) return;
    const interval = setInterval(async () => {
      try {
        const jobs = await api.get<{ assignment_id: number; service_type_name?: string; uuid?: string; current_status?: string }[]>('/providers/jobs');
        jobs.forEach((job) => {
          if (!knownJobIds.current.has(job.assignment_id)) {
            knownJobIds.current.add(job.assignment_id);
            const title = 'New job assigned!';
            const body = job.service_type_name
              ? `A ${job.service_type_name} request needs your attention.`
              : 'A new job has been assigned to you.';
            showBrowserNotification(title, body);
            const note: AppNotification = {
              id: `job-${job.assignment_id}`,
              title,
              body,
              href: '/provider/dashboard',
              read: false,
              timestamp: new Date(),
            };
            setNotifications((prev) => [note, ...prev].slice(0, 50));
          }
        });
      } catch {
        // ignore poll errors
      }
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [isProvider]);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be inside NotificationProvider');
  return ctx;
}
