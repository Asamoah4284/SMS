'use client';

import Link from 'next/link';
import { AlertCircle, CheckCircle2, Info, ArrowRight } from 'lucide-react';

export type QuickNote = {
  id: string;
  text: string;
  href?: string;
  tone: 'info' | 'warning' | 'success';
};

const TONE_STYLES = {
  info: {
    icon: Info,
    dot: 'bg-blue-500',
    bg: 'bg-blue-50/60 hover:bg-blue-50',
    text: 'text-blue-900',
  },
  warning: {
    icon: AlertCircle,
    dot: 'bg-amber-500',
    bg: 'bg-amber-50/60 hover:bg-amber-50',
    text: 'text-amber-900',
  },
  success: {
    icon: CheckCircle2,
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-50/60 hover:bg-emerald-50',
    text: 'text-emerald-900',
  },
};

export default function QuickNotesPanel({ notes }: { notes: QuickNote[] }) {
  if (!notes.length) {
    return (
      <p className="text-xs text-gray-500">No reminders right now.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {notes.map((note) => {
        const style = TONE_STYLES[note.tone] ?? TONE_STYLES.info;
        const Icon = style.icon;
        const inner = (
          <div
            className={[
              'flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors border border-transparent',
              style.bg,
              note.href ? 'cursor-pointer' : '',
            ].join(' ')}
          >
            <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-semibold leading-snug ${style.text}`}>{note.text}</p>
            </div>
            {note.href ? (
              <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${style.text} opacity-70`} />
            ) : null}
          </div>
        );

        return (
          <li key={note.id}>
            {note.href ? (
              <Link href={note.href} className="block group">
                {inner}
                <span className="sr-only">Open</span>
              </Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function QuickNotesFooterLink() {
  return (
    <Link
      href="/announcements"
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 mt-3"
    >
      Post announcement <ArrowRight className="w-3.5 h-3.5" />
    </Link>
  );
}
