import React, { forwardRef } from 'react';
import { clsx } from 'clsx';

export const Input = forwardRef(({ className, label, error, ...props }, ref) => {
  return (
    <div className={clsx('input-container', className)}>
      {label && <label className="input-label">{label}</label>}
      <input ref={ref} className={clsx('input-field', error && 'input-error')} {...props} />
      {error && <span className="input-error-msg">{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';
