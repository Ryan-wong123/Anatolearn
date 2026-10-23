import type { ReactNode } from 'react';
import Dialog from '../Dialog';

// Accessible modal (focus trap, Escape to close, inert background) using the app's shared Dialog.
export default function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <Dialog onClose={onClose} className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
      <div className={`w-full ${wide ? 'max-w-lg' : 'max-w-md'} rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900`}>
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100 font-display">{title}</h2>
        {children}
      </div>
    </Dialog>
  );
}
