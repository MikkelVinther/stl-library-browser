import { Trash2, Box } from 'lucide-react';
import type { SceneObject } from '../../types/scene';

interface SceneObjectListProps {
  objects: SceneObject[];
  selectedObjectIds: string[];
  onSelect: (id: string, toggle?: boolean) => void;
  onRemove: (id: string) => void;
}

export function SceneObjectList({ objects, selectedObjectIds, onSelect, onRemove }: SceneObjectListProps) {
  if (objects.length === 0) {
    return (
      <p className="text-xs text-faint px-2 py-3 text-center">
        No objects in scene. Add models from the library below.
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      {objects.map((obj) => {
        const isSelected = selectedObjectIds.includes(obj.id);
        return (
          <div
            key={obj.id}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer group transition-colors ${
              isSelected ? 'bg-[rgba(58,203,255,0.16)] text-cyan-200' : 'hover:bg-[rgba(146,173,220,0.08)] text-slate-300'
            }`}
            onClick={(e) => onSelect(obj.id, e.shiftKey || e.metaKey || e.ctrlKey)}
          >
            <Box className={`w-3.5 h-3.5 flex-shrink-0 ${
              obj.loadStatus === 'loading' ? 'animate-pulse text-amber-300' :
              obj.loadStatus === 'error' ? 'text-red-400' :
              isSelected ? 'text-cyan-300' : 'text-faint'
            }`} />
            <span className="flex-1 text-xs truncate min-w-0" title={obj.fileName}>
              {obj.fileName || obj.fileId.slice(0, 8)}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(obj.id); }}
              title="Remove from scene"
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-faint hover:text-red-400 transition-all flex-shrink-0"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
