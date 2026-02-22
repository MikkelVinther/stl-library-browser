import { useState } from 'react';
import { Search, X } from 'lucide-react';
import type { SceneState, SceneObject } from '../../types/scene';
import type { STLFile } from '../../types/index';
import { SceneObjectList } from './SceneObjectList';
import { SceneSidebarFileCard } from './SceneSidebarFileCard';

interface SceneSidebarProps {
  sceneState: SceneState;
  allFiles: STLFile[];
  onSelectObject: (id: string) => void;
  onRemoveObject: (id: string) => void;
  onAddFile: (file: STLFile) => void;
  onColorChange: (objectId: string, color: string) => void;
}

export function SceneSidebar({
  sceneState, allFiles, onSelectObject, onRemoveObject, onAddFile, onColorChange,
}: SceneSidebarProps) {
  const [search, setSearch] = useState('');

  const { objects, selectedObjectId } = sceneState;
  const selectedObject = objects.find((o) => o.id === selectedObjectId) ?? null;

  const filtered = allFiles.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="w-64 flex flex-col h-full border-l border-[rgba(146,173,220,0.12)] bg-[rgba(14,22,40,0.7)]">
      {/* Object list */}
      <div className="p-3 border-b border-[rgba(146,173,220,0.12)]">
        <h3 className="ui-section-label mb-2">Scene Objects</h3>
        <div className="max-h-48 overflow-y-auto">
          <SceneObjectList
            objects={objects}
            selectedObjectId={selectedObjectId}
            onSelect={onSelectObject}
            onRemove={onRemoveObject}
          />
        </div>
      </div>

      {/* Selected object color */}
      {selectedObject && (
        <div className="p-3 border-b border-[rgba(146,173,220,0.12)]">
          <h3 className="ui-section-label mb-2">Color</h3>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={selectedObject.color ?? '#6090c0'}
              onChange={(e) => onColorChange(selectedObject.id, e.target.value)}
              className="w-8 h-8 rounded cursor-pointer bg-transparent border border-[rgba(146,173,220,0.24)] p-0.5"
            />
            <span className="text-xs text-faint">{selectedObject.color ?? '#6090c0'}</span>
            {selectedObject.color && (
              <button
                onClick={() => onColorChange(selectedObject.id, '')}
                className="p-1 text-faint hover:text-slate-200 transition-colors"
                title="Reset to default color"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Library browser */}
      <div className="flex-1 flex flex-col min-h-0 p-3">
        <h3 className="ui-section-label mb-2">Add from Library</h3>
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ui-input w-full pl-8 pr-3 py-1.5 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-cyan-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {filtered.map((file) => (
            <SceneSidebarFileCard key={file.id} file={file} onAdd={onAddFile} />
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-faint text-center py-4">No files found</p>
          )}
        </div>
      </div>
    </aside>
  );
}
