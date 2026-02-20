interface ContentHeaderProps {
  filteredCount: number;
  activeFilterCount: number;
  onSelectAll: () => void;
  onClearFilters: () => void;
}

export function ContentHeader({ filteredCount, activeFilterCount, onSelectAll, onClearFilters }: ContentHeaderProps) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <p className="text-sm text-gray-500">
        <span className="text-gray-300 font-semibold">{filteredCount}</span>{' '}
        file{filteredCount !== 1 && 's'}
        {activeFilterCount > 0 && ' matching'}
      </p>
      <div className="flex items-center gap-3">
        {filteredCount > 0 && (
          <button onClick={onSelectAll} className="text-xs text-gray-500 hover:text-blue-400 transition-colors">
            Select all
          </button>
        )}
        {activeFilterCount > 0 && (
          <button onClick={onClearFilters} className="hidden lg:block text-xs text-gray-500 hover:text-blue-400 transition-colors">
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
