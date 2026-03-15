import React from 'react';
import { clsx } from 'clsx';

export function Card({ children, className, hover = true, ...props }) {
  return (
    <div className={clsx('card-base', hover && 'card-hover', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }) {
  return (
    <div className={clsx('flex flex-col space-y-1.5 p-6', className)} {...props} style={{ padding: '1.5rem', paddingBottom: '0.5rem', ...props.style }}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className, ...props }) {
  return (
    <h3 className={clsx('font-semibold leading-none tracking-tight', className)} {...props} style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', ...props.style }}>
      {children}
    </h3>
  );
}

export function CardContent({ children, className, ...props }) {
  return (
    <div className={clsx('p-6 pt-0', className)} {...props} style={{ padding: '1.5rem', paddingTop: '0', ...props.style }}>
      {children}
    </div>
  );
}
