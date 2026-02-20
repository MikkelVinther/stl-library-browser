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
    <button
      onClick={() => onOpen(file)}
      className="group text-left bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
    >
      <div
        className={`relative h-40 ${
          file.thumbnail ? 'bg-gray-950' : `bg-gradient-to-br ${style.gradient}`
        } flex items-center justify-center overflow-hidden`}
      >
        {file.thumbnail ? (
          <img src={file.thumbnail} alt={file.name} className="w-full h-full object-contain" />
        ) : (
          <>
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            />
            <RoleIcon className="w-14 h-14 text-white/10 group-hover:text-white/20 transition-colors duration-300" />
          </>
        )}
        {role && (
          <span className={`absolute top-2.5 right-2.5 ${style.badge} text-white/90 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md z-10`}>
            {role}
          </span>
        )}
        <div className={`absolute top-2.5 left-2.5 z-10 transition-opacity ${bulkMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <button
            onClick={(e) => onToggleSelect(file.id, e)}
            className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
              isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-400 bg-black/30 hover:border-blue-400'
            }`}
          >
            {isSelected && <Check className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>
      <div className="p-3.5">
        <h3 className="font-semibold text-sm text-gray-200 truncate group-hover:text-blue-400 transition-colors">
          {file.name}
        </h3>
        <p className="text-xs text-gray-500 mt-1 font-medium">
          {file.size}
          {file.categories?.creator && (
            <span className="ml-2 text-gray-600">{file.categories.creator}</span>
          )}
        </p>
        <div className="flex flex-wrap gap-1 mt-2.5">
          {(file.tags || []).slice(0, 3).map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px] text-gray-500 ring-1 ring-gray-800">
              {tag}
            </span>
          ))}
          {(file.tags || []).length > 3 && (
            <span className="px-1.5 py-0.5 text-[10px] text-gray-600">
              +{file.tags.length - 3}
            </span>
          )}
        </div>
      </div>
    </button>
  );
});
