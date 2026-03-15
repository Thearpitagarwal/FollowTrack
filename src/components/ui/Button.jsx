import React from 'react';
import { clsx } from 'clsx';
import './ui.css'; // Add a generic UI CSS for these components, but we can also do inline styles or modular css as needed. Let's use class names from globals.css or component.css.
export function Button({ 
  children, 
  variant = 'primary', 
  className, 
  ...props 
}) {
  const baseClass = 'btn-base';
  const variantClass = `btn-${variant}`;

  return (
    <button className={clsx(baseClass, variantClass, className)} {...props}>
      {children}
    </button>
  );
}
