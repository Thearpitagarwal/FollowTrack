import React from 'react';
import { clsx } from 'clsx';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './ui.css';

export function Modal({ isOpen, onClose, title, children, className }) {
  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay">
      <div className={clsx('modal-content animate-fade-up', className)}>
        <button onClick={onClose} className="modal-close">
          <X size={20} />
        </button>
        {title && <h3 className="modal-title">{title}</h3>}
        {children}
      </div>
    </div>,
    document.body
  );
}
