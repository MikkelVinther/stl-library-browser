import { memo } from 'react';
import { Search, X, Upload, FolderOpen } from 'lucide-react';
import { CATEGORY_IDS, CATEGORY_LABELS } from '../utils/categoryClassifier';

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
}

export const FilterSidebar = memo(function FilterSidebar({
  searchTerm, onSearchChange,
  categoryFacets, selectedCategories, onToggleCategoryValue,
  allTags, selectedTags, onToggleTag,
  activeFilterCount, onClearFilters,
  onImportFiles, onOpenFolder,
  isMobile = false,
}: FilterSidebarProps) {
  return (
    <div className="space-y-6">
      <button
        onClick={onImportFiles}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        <Upload className="w-4 h-4" />
        Import STL Files
      </button>
      <button
        onClick={onOpenFolder}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        <FolderOpen className="w-4 h-4" />
        Open Folder
      </button>

      {!isMobile && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search STL files..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 bg-gray-900/60 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-transparent transition-shadow"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
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
            <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
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
                        ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30'
                        : 'text-gray-400 hover:bg-gray-700/40 hover:text-gray-200'
                    }`}
                  >
                    <span className="truncate">{value}</span>
                    <span className="text-xs text-gray-600 ml-2 flex-shrink-0">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {allTags.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Tags</h3>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => onToggleTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    active
                      ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 ring-1 ring-gray-700'
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
          className="w-full py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
});
