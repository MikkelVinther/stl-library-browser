import { useRef, useState, useEffect } from 'react';
import type { MouseEvent } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { Box } from 'lucide-react';
import type { STLFile } from '../types/index';
import { FileCard } from './FileCard';

// Row height estimate: h-40 image (160) + content (~84) + gap (16) ≈ 260px
const ESTIMATED_ROW_HEIGHT = 260;

/** Map viewport width to grid column count, matching Tailwind breakpoints. */
function getColumnsPerRow(viewportWidth: number): number {
  if (viewportWidth >= 1280) return 4; // xl
  if (viewportWidth >= 1024) return 3; // lg
  if (viewportWidth >= 640) return 2;  // sm
  return 1;
}

function useColumnsPerRow(): number {
  const [cols, setCols] = useState(() => getColumnsPerRow(window.innerWidth));
  useEffect(() => {
    const update = () => setCols(getColumnsPerRow(window.innerWidth));
    window.addEventListener('resize', update, { passive: true });
    return () => window.removeEventListener('resize', update);
  }, []);
  return cols;
}

interface FileGridProps {
  files: STLFile[];
  selectedIds: Set<string>;
  bulkMode: boolean;
  onOpenFile: (file: STLFile) => void;
  onToggleSelect: (id: string, e: MouseEvent) => void;
  onClearFilters: () => void;
}

export function FileGrid({ files, selectedIds, bulkMode, onOpenFile, onToggleSelect, onClearFilters }: FileGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const cols = useColumnsPerRow();
  const rowCount = Math.ceil(files.length / cols);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 3,
    // scrollMargin: distance from top of page to the top of this container
    scrollMargin: parentRef.current?.offsetTop ?? 0,
  });

  if (files.length === 0) {
    return (
      <div className="text-center py-24 surface-panel rounded-2xl">
        <Box className="w-12 h-12 text-faint mx-auto mb-4" />
        <p className="text-soft text-sm">No files match your filters</p>
        <button
          onClick={onClearFilters}
          className="mt-3 ui-btn ui-btn-ghost text-xs"
        >
          Clear all filters
        </button>
      </div>
    );
  }

  const virtualRows = virtualizer.getVirtualItems();
  const scrollMargin = virtualizer.options.scrollMargin ?? 0;

  return (
    <div ref={parentRef}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${(virtualRows[0]?.start ?? 0) - scrollMargin}px)`,
          }}
        >
          {virtualRows.map((virtualRow) => {
            const startIdx = virtualRow.index * cols;
            const rowFiles = files.slice(startIdx, Math.min(startIdx + cols, files.length));
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4"
              >
                {rowFiles.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    isSelected={selectedIds.has(file.id)}
                    bulkMode={bulkMode}
                    onOpen={onOpenFile}
                    onToggleSelect={onToggleSelect}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
