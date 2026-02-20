import { Box, Search, Filter } from 'lucide-react';

interface MobileTopBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  activeFilterCount: number;
  onOpenFilters: () => void;
}

export function MobileTopBar({ searchTerm, onSearchChange, activeFilterCount, onOpenFilters }: MobileTopBarProps) {
  return (
    <header className="lg:hidden sticky top-0 z-30 bg-gray-950/90 backdrop-blur-md border-b border-gray-800 px-4 py-3">
      <div className="flex items-center gap-3">
        <Box className="w-5 h-5 text-blue-400 flex-shrink-0" />
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
          />
        </div>
        <button
          onClick={onOpenFilters}
          className="relative p-2.5 bg-gray-900 border border-gray-800 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Filter className="w-4 h-4 text-gray-400" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-blue-500 text-[10px] font-bold text-white rounded-full px-1">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
