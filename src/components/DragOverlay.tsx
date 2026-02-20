import { Upload } from 'lucide-react';

interface DragOverlayProps {
  isDragging: boolean;
}

export function DragOverlay({ isDragging }: DragOverlayProps) {
  if (!isDragging) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overlay-backdrop pointer-events-none">
      <div className="text-center p-8 rounded-2xl border-2 border-dashed border-cyan-300/60 bg-[rgba(10,18,34,0.9)] shadow-[0_0_0_1px_rgba(58,203,255,0.24),0_18px_48px_rgba(2,10,26,0.66)]">
        <Upload className="w-16 h-16 text-cyan-200 mx-auto mb-4" />
        <p className="text-xl font-semibold brand-title text-cyan-100">Drop STL files here</p>
        <p className="text-sm text-soft mt-1">Files will be added to your library</p>
      </div>
    </div>
  );
}
