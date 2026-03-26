'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type DropdownMenuItem = {
  label: string;
  href?: string;
  disabled?: boolean;
};

interface DropdownMenuProps {
  items: DropdownMenuItem[];
  triggerLabel?: string;
  align?: 'left' | 'right';
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  iconOnly?: boolean;
  triggerIcon?: React.ReactNode;
}

export function DropdownMenu({
  items,
  triggerLabel = 'Menu',
  align = 'right',
  className = '',
  buttonClassName = '',
  menuClassName = '',
  iconOnly = false,
  triggerIcon,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={buttonClassName || 'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50'}
      >
        {triggerIcon}
        {!iconOnly && <span>{triggerLabel}</span>}
        {!iconOnly && <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>

      {open && (
        <div
          role="menu"
          className={[
            'absolute z-40 mt-2 w-52 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg shadow-gray-900/10',
            align === 'right' ? 'right-0' : 'left-0',
            menuClassName,
          ].join(' ')}
        >
          {items.map((item) => {
            if (item.href && !item.disabled) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                >
                  {item.label}
                </Link>
              );
            }

            return (
              <span
                key={item.label}
                role="menuitem"
                aria-disabled
                className="block cursor-not-allowed rounded-lg px-3 py-2 text-sm font-medium text-gray-400"
              >
                {item.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
