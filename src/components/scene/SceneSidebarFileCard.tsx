import { Plus, AlertCircle } from 'lucide-react';
import type { STLFile } from '../../types/index';

interface SceneSidebarFileCardProps {
  file: STLFile;
  onAdd: (file: STLFile) => void;
}

export function SceneSidebarFileCard({ file, onAdd }: SceneSidebarFileCardProps) {
  const canAdd = file.fullPath !== null;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[rgba(146,173,220,0.08)] group">
      {file.thumbnail ? (
        <img
          src={file.thumbnail}
          alt=""
          className="w-8 h-8 rounded object-cover flex-shrink-0 bg-[rgba(58,203,255,0.08)]"
        />
      ) : (
        <div className="w-8 h-8 rounded flex-shrink-0 bg-[rgba(58,203,255,0.08)]" />
      )}

      <span className="flex-1 text-xs text-slate-200 truncate min-w-0" title={file.name}>
        {file.name}
      </span>

      {canAdd ? (
        <button
          onClick={() => onAdd(file)}
          title="Add to scene"
          className="opacity-0 group-hover:opacity-100 p-1 rounded text-faint hover:text-cyan-200 transition-all flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      ) : (
        <span title="Source file missing — cannot add to scene">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 opacity-60" />
        </span>
      )}
    </div>
  );
}
