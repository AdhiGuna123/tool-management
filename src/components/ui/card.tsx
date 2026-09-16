import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean;
}

export default function Card({ className = '', padding = true, children, ...props }: CardProps) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 ${padding ? 'p-4 sm:p-6' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
