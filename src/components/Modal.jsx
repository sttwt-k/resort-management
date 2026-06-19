import React from 'react';
import { X } from 'lucide-react';

export const Modal = ({ title, isOpen, onClose, children, footer, maxWidth = 'max-w-lg' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex justify-center p-4 overflow-y-auto">
      <div className={`bg-white rounded-[2rem] shadow-2xl w-full ${maxWidth} relative flex flex-col my-auto max-h-[95vh] animate-fade-in overflow-hidden`}>
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white shrink-0 z-10">
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto bg-white custom-scrollbar flex-1">{children}</div>
        {footer && (
          <div className="px-6 pb-5 pt-3 border-t border-slate-100 bg-white shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export const ConfirmModal = ({ dialog, onClose }) => {
  if (!dialog) return null;
  const {
    title, message,
    confirmLabel = 'ยืนยัน',
    cancelLabel = 'ยกเลิก',
    variant = 'default',
    onConfirm,
    onCancel,
  } = dialog;

  const confirmColors =
    variant === 'danger'   ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-100' :
    variant === 'warning'  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-100' :
                             'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm animate-slide-up sm:animate-fade-in overflow-hidden">
        <div className="p-6 space-y-2">
          {title && <h3 className="text-lg font-bold text-slate-800">{title}</h3>}
          <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{message}</p>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={() => { if (onCancel) onCancel(); onClose(); }}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 py-3 rounded-2xl font-bold shadow-lg transition-all active:scale-95 ${confirmColors}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
