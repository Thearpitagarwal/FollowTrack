import React from 'react';
import { clsx } from 'clsx';

export function Badge({ risk, children, className }) {
  const riskClass = risk ? `badge-${risk.toLowerCase()}` : 'badge-default';
  return (
    <span className={clsx('badge-base', riskClass, className)}>
      {children || risk}
    </span>
  );
}
