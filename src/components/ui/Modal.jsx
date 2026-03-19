import React from 'react';
import { clsx } from 'clsx';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import '../../pages/teacher/teacher.css';
import './ui.css';

export function Modal({ isOpen, onClose, title, children, className }) {
  if (!isOpen) return null;

  return createPortal(
    <div className="modal-backdrop">
      <div className={clsx('modal-box', className)}>
        <div className="modal-header">
          {title ? <h3 className="modal-title">{title}</h3> : <div />}
          <button onClick={onClose} className="modal-close-btn">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
