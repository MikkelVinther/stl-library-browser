interface ContentHeaderProps {
  filteredCount: number;
  activeFilterCount: number;
  onSelectAll: () => void;
  onClearFilters: () => void;
}

export function ContentHeader({ filteredCount, activeFilterCount, onSelectAll, onClearFilters }: ContentHeaderProps) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <p className="text-sm text-soft">
        <span className="text-slate-100 font-semibold">{filteredCount}</span>{' '}
        file{filteredCount !== 1 && 's'}
        {activeFilterCount > 0 && ' matching'}
      </p>
      <div className="flex items-center gap-3">
        {filteredCount > 0 && (
          <button onClick={onSelectAll} className="ui-btn ui-btn-ghost text-xs px-2 py-1">
            Select all
          </button>
        )}
        {activeFilterCount > 0 && (
          <button onClick={onClearFilters} className="hidden lg:block ui-btn ui-btn-ghost text-xs px-2 py-1">
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
