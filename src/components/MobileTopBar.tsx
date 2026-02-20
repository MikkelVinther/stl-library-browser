import { Box, Search, Filter } from 'lucide-react';

interface MobileTopBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  activeFilterCount: number;
  onOpenFilters: () => void;
}

export function MobileTopBar({ searchTerm, onSearchChange, activeFilterCount, onOpenFilters }: MobileTopBarProps) {
  return (
    <header className="lg:hidden sticky top-0 z-30 surface-panel border-x-0 rounded-b-2xl px-4 py-3">
      <div className="flex items-center gap-3">
        <Box className="w-5 h-5 text-cyan-300 flex-shrink-0" />
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="ui-input w-full pl-10 pr-4 py-2 text-sm"
          />
        </div>
        <button
          onClick={onOpenFilters}
          className="relative p-2.5 ui-btn ui-btn-secondary"
        >
          <Filter className="w-4 h-4 text-soft" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-cyan-300 text-[10px] font-bold text-slate-900 rounded-full px-1">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
