import { memo } from 'react';
import { Search, X, Upload, FolderOpen, Layers, Trash2, Plus } from 'lucide-react';
import { CATEGORY_IDS, CATEGORY_LABELS } from '../utils/categoryClassifier';
import type { SceneMeta } from '../types/scene';

interface FilterSidebarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  categoryFacets: Record<string, Record<string, number>>;
  selectedCategories: Record<string, string[]>;
  onToggleCategoryValue: (catId: string, value: string) => void;
  allTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  activeFilterCount: number;
  onClearFilters: () => void;
  onImportFiles: () => void;
  onOpenFolder: () => void;
  isMobile?: boolean;
  scenes?: SceneMeta[];
  onOpenScene?: (id: string) => void;
  onDeleteScene?: (id: string) => void;
  onNewEmptyScene?: () => void;
}

export const FilterSidebar = memo(function FilterSidebar({
  searchTerm, onSearchChange,
  categoryFacets, selectedCategories, onToggleCategoryValue,
  allTags, selectedTags, onToggleTag,
  activeFilterCount, onClearFilters,
  onImportFiles, onOpenFolder,
  isMobile = false,
  scenes, onOpenScene, onDeleteScene, onNewEmptyScene,
}: FilterSidebarProps) {
  return (
    <div className="space-y-6">
      <button
        onClick={onImportFiles}
        className="ui-btn ui-btn-primary w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm"
      >
        <Upload className="w-4 h-4" />
        Import STL Files
      </button>
      <button
        onClick={onOpenFolder}
        className="ui-btn ui-btn-secondary w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm"
      >
        <FolderOpen className="w-4 h-4" />
        Open Folder
      </button>

      {!isMobile && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
          <input
            type="text"
            placeholder="Search STL files..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="ui-input w-full pl-10 pr-9 py-2.5 text-sm"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-cyan-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {CATEGORY_IDS.map((catId) => {
        const values = categoryFacets[catId];
        if (!values) return null;
        const sorted = Object.entries(values).sort((a, b) => b[1] - a[1]);
        const selected = selectedCategories[catId] || [];
        return (
          <div key={catId}>
            <h3 className="ui-section-label mb-3">
              {CATEGORY_LABELS[catId]}
            </h3>
            <div className="space-y-1">
              {sorted.map(([value, count]) => {
                const active = selected.includes(value);
                return (
                  <button
                    key={value}
                    onClick={() => onToggleCategoryValue(catId, value)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? 'ui-chip-active'
                        : 'ui-chip hover:text-slate-100'
                    }`}
                  >
                    <span className="truncate">{value}</span>
                    <span className="text-xs text-faint ml-2 flex-shrink-0">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {allTags.length > 0 && (
        <div>
          <h3 className="ui-section-label mb-3">Tags</h3>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => onToggleTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    active
                      ? 'ui-chip-active shadow-[0_0_0_1px_rgba(58,203,255,0.28)]'
                      : 'ui-chip hover:text-slate-100'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeFilterCount > 0 && (
        <button
          onClick={onClearFilters}
          className="ui-btn ui-btn-ghost w-full py-2 text-xs"
        >
          Clear all filters
        </button>
      )}

      {(scenes !== undefined) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="ui-section-label flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Scenes
            </h3>
            {onNewEmptyScene && (
              <button
                onClick={onNewEmptyScene}
                title="New empty scene"
                className="p-1 rounded-md text-faint hover:text-cyan-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {scenes.length === 0 ? (
            <p className="text-xs text-faint px-1">No scenes yet. Select files and click "New Scene".</p>
          ) : (
            <div className="space-y-1">
              {scenes.map((scene) => (
                <div key={scene.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => onOpenScene?.(scene.id)}
                    className="flex-1 text-left px-3 py-2 rounded-lg text-sm ui-chip hover:text-slate-100 truncate"
                  >
                    {scene.name}
                  </button>
                  <button
                    onClick={() => onDeleteScene?.(scene.id)}
                    title="Delete scene"
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-faint hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
