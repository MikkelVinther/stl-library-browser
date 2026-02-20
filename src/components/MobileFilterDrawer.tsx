import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function MobileFilterDrawer({ isOpen, onClose, children }: MobileFilterDrawerProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-gray-900 border-l border-gray-800 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-base">Filters</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
