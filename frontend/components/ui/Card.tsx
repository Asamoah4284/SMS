'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
}

export function Card({ children, className, hoverable = false }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white border border-gray-200 rounded-2xl shadow-[var(--shadow-card)]',
        hoverable &&
          'hover:shadow-[var(--shadow-card-hover)] transition-shadow cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children?: ReactNode;
}

export function CardHeader({
  title,
  subtitle,
  action,
  children,
}: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between p-6 border-b border-gray-200">
      <div>
        {title && <h3 className="text-lg font-bold text-gray-900">{title}</h3>}
        {subtitle && (
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
      {children && !title && <div>{children}</div>}
    </div>
  );
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export function CardBody({ children, className }: CardBodyProps) {
  return <div className={cn('p-6', className)}>{children}</div>;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={cn('flex gap-3 p-6 border-t border-gray-200', className)}>
      {children}
    </div>
  );
}
