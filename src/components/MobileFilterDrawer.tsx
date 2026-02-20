import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useDialog } from '../hooks/useDialog';

interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function MobileFilterDrawer({ isOpen, onClose, children }: MobileFilterDrawerProps) {
  const { dialogRef } = useDialog(isOpen, onClose);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div className="absolute inset-0 overlay-backdrop" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] overlay-panel border-l-0 overflow-y-auto"
      >
        <div className="sticky top-0 bg-[rgba(13,22,39,0.95)] backdrop-blur p-4 border-b border-[rgba(71,205,255,0.28)] flex items-center justify-between">
          <h2 className="font-semibold text-base brand-title tracking-[0.04em]">Filters</h2>
          <button onClick={onClose} className="p-1.5 ui-btn ui-btn-ghost">
            <X className="w-5 h-5 text-soft" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
