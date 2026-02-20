import { memo } from 'react';
import type { MouseEvent } from 'react';
import { Box, Check } from 'lucide-react';
import type { STLFile } from '../types/index';
import { getRoleStyle, ROLE_ICON_MAP } from '../constants/roleStyles';

interface FileCardProps {
  file: STLFile;
  isSelected: boolean;
  bulkMode: boolean;
  onOpen: (file: STLFile) => void;
  onToggleSelect: (id: string, e: MouseEvent) => void;
}

export const FileCard = memo(function FileCard({ file, isSelected, bulkMode, onOpen, onToggleSelect }: FileCardProps) {
  const role = file.categories?.role;
  const style = getRoleStyle(role);
  const RoleIcon = ROLE_ICON_MAP[role ?? ''] || Box;

  return (
    <article className="grid-card group rounded-xl overflow-hidden transition-all duration-200 relative">
      <button
        onClick={() => onOpen(file)}
        className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
      >
      <div
        className={`relative h-40 ${
          file.thumbnail ? 'bg-slate-950' : `bg-gradient-to-br ${style.gradient}`
        } flex items-center justify-center overflow-hidden`}
      >
        {file.thumbnail ? (
          <img src={file.thumbnail} alt={file.name} className="w-full h-full object-contain" />
        ) : (
          <>
            <div
              className="absolute inset-0 subtle-grid opacity-[0.08]"
              style={{
                backgroundSize: '20px 20px',
              }}
            />
            <RoleIcon className="w-14 h-14 text-white/15 group-hover:text-white/25 transition-colors duration-300" />
          </>
        )}
        {role && (
          <span className={`absolute top-2.5 right-2.5 ${style.badge} text-white/90 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md z-10 shadow-lg`}>
            {role}
          </span>
        )}
      </div>
      <div className="p-3.5">
        <h3 className="font-semibold text-sm text-slate-100 truncate group-hover:text-cyan-200 transition-colors">
          {file.name}
        </h3>
        <p className="text-xs text-soft mt-1 font-medium">
          {file.size}
          {file.categories?.creator && (
            <span className="ml-2 text-faint">{file.categories.creator}</span>
          )}
        </p>
        <div className="flex flex-wrap gap-1 mt-2.5">
          {(file.tags || []).slice(0, 3).map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] text-soft ring-1 ring-[rgba(146,173,220,0.25)] bg-[rgba(10,18,34,0.72)]">
              {tag}
            </span>
          ))}
          {(file.tags || []).length > 3 && (
            <span className="px-1.5 py-0.5 text-[10px] text-faint">
              +{file.tags.length - 3}
            </span>
          )}
        </div>
      </div>
      </button>
      <div className={`absolute top-2.5 left-2.5 z-10 transition-opacity ${bulkMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <button
          onClick={(e) => onToggleSelect(file.id, e)}
          aria-label={isSelected ? `Deselect ${file.name}` : `Select ${file.name}`}
          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
            isSelected ? 'bg-cyan-300 border-cyan-300 text-slate-900' : 'border-cyan-200/60 bg-[rgba(0,8,21,0.55)] hover:border-cyan-300'
          }`}
        >
          {isSelected && <Check className="w-4 h-4" />}
        </button>
      </div>
    </article>
  );
});
