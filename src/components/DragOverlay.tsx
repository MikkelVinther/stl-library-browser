import { Upload } from 'lucide-react';

interface DragOverlayProps {
  isDragging: boolean;
}

export function DragOverlay({ isDragging }: DragOverlayProps) {
  if (!isDragging) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-blue-500/10 backdrop-blur-sm pointer-events-none">
      <div className="text-center p-8 rounded-2xl border-2 border-dashed border-blue-500/50 bg-gray-900/80">
        <Upload className="w-16 h-16 text-blue-400 mx-auto mb-4" />
        <p className="text-xl font-semibold text-blue-300">Drop STL files here</p>
        <p className="text-sm text-gray-400 mt-1">Files will be added to your library</p>
      </div>
    </div>
  );
}
