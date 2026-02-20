import { Box, X, Tag, Loader2, Eye, Settings } from 'lucide-react';
import { useDialog } from '../hooks/useDialog';
import STLViewer from './STLViewer';
import PrintSettingsPopover from './PrintSettingsPopover';
import { CATEGORY_IDS, CATEGORY_LABELS } from '../utils/categoryClassifier';
import { getRoleStyle, ROLE_ICON_MAP } from '../constants/roleStyles';
import type { STLFile, ViewerState, CategoryValues, PrintSettings } from '../types/index';

interface FileDetailModalProps {
  file: STLFile;
  fileTagsEdit: string[];
  fileCategoriesEdit: CategoryValues;
  onCategoryChange: (catId: string, value: string | undefined) => void;
  newTag: string;
  onNewTagChange: (val: string) => void;
  viewerState: ViewerState;
  showPrintSettings: boolean;
  onTogglePrintSettings: () => void;
  tagsChanged: boolean;
  categoriesChanged: boolean;
  onClose: () => void;
  onLoad3D: () => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  onSaveTags: () => void;
  onSaveCategories: () => void;
  onSavePrintSettings: (settings: PrintSettings) => void;
}

export function FileDetailModal({
  file, fileTagsEdit, fileCategoriesEdit, onCategoryChange,
  newTag, onNewTagChange, viewerState,
  showPrintSettings, onTogglePrintSettings,
  tagsChanged, categoriesChanged,
  onClose, onLoad3D, onAddTag, onRemoveTag, onSaveTags, onSaveCategories, onSavePrintSettings,
}: FileDetailModalProps) {
  const role = file.categories?.role;
  const style = getRoleStyle(role);
  const RoleIcon = ROLE_ICON_MAP[role ?? ''] || Box;
  const { dialogRef } = useDialog(true, onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 overlay-backdrop" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${file.name}`}
        className="relative overlay-panel rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >

        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1.5 ui-btn ui-btn-secondary"
        >
          <X className="w-4 h-4 text-soft" />
        </button>

        {/* Large preview */}
        <div
          className={`relative h-72 sm:h-80 ${
            viewerState.status === 'loaded' ? 'bg-gray-950' : `bg-gradient-to-br ${style.gradient}`
          } flex items-center justify-center rounded-t-2xl overflow-hidden`}
        >
          {viewerState.status === 'loaded' ? (
            <STLViewer geometry={viewerState.geometry} interactive className="w-full h-full" />
          ) : viewerState.status === 'loading' ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-white/40 animate-spin" />
              <p className="text-sm text-white/40">Loading 3D model...</p>
            </div>
          ) : viewerState.status === 'error' ? (
            <div className="flex flex-col items-center gap-2">
              <X className="w-10 h-10 text-red-400/60" />
              <p className="text-sm text-red-400/60">Failed to load model</p>
            </div>
          ) : (
            <>
              {file.thumbnail ? (
                <img src={file.thumbnail} alt={file.name} className="w-full h-full object-contain" />
              ) : (
                <>
                  <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                      backgroundImage:
                        'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
                      backgroundSize: '24px 24px',
                    }}
                  />
                  <RoleIcon className="w-24 h-24 text-white/10" />
                </>
              )}
              {file.fullPath && (
                <button
                  onClick={onLoad3D}
                  className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 ui-btn ui-btn-primary text-sm"
                >
                  <Eye className="w-4 h-4" />
                  Load 3D Model
                </button>
              )}
            </>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          <h2 className="text-xl font-bold tracking-tight brand-title">{file.name}</h2>
          <div className="flex items-center gap-3 mt-2 mb-5">
            <span className="text-sm text-soft font-medium">{file.size}</span>
            {role && (
              <span className={`${style.badge} text-white text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md`}>
                {role}
              </span>
            )}
            {viewerState.status === 'loaded' && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md bg-cyan-300 text-slate-900">3D</span>
            )}
          </div>

          {/* Categories */}
          <div className="border-t border-[rgba(146,173,220,0.18)] pt-5 mb-5">
            <h3 className="ui-section-label mb-3">Categories</h3>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORY_IDS.map((catId) => (
                <div key={catId}>
                  <label className="text-[10px] text-faint uppercase tracking-wider">{CATEGORY_LABELS[catId]}</label>
                  <input
                    type="text"
                    value={fileCategoriesEdit[catId] || ''}
                    onChange={(e) => onCategoryChange(catId, e.target.value || undefined)}
                    placeholder="—"
                    className="ui-input w-full text-sm py-1.5 px-2 mt-1"
                  />
                </div>
              ))}
            </div>
            {categoriesChanged && (
              <button
                onClick={onSaveCategories}
                className="mt-3 w-full py-2 ui-btn bg-[var(--success)] hover:bg-emerald-300 text-slate-900 text-sm font-semibold rounded-lg transition-colors"
              >
                Save Categories
              </button>
            )}
          </div>

          {/* Tags */}
          <div className="border-t border-[rgba(146,173,220,0.18)] pt-5">
            <h3 className="ui-section-label mb-3 flex items-center gap-2">
              <Tag className="w-3.5 h-3.5" />
              Tags
            </h3>
            <div className="flex flex-wrap gap-2 mb-4 min-h-[32px]">
              {fileTagsEdit.map((tag) => (
                <span key={tag} className="group/tag flex items-center gap-1.5 px-3 py-1 rounded-full text-sm text-soft ring-1 ring-[rgba(146,173,220,0.3)] bg-[rgba(13,23,41,0.82)]">
                  {tag}
                  <button onClick={() => onRemoveTag(tag)} className="text-faint hover:text-red-300 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {fileTagsEdit.length === 0 && <span className="text-sm text-faint italic">No tags</span>}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => onNewTagChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onAddTag()}
                placeholder="Add a tag..."
                className="ui-input flex-1 px-3 py-2 text-sm"
              />
              <button
                onClick={onAddTag}
                disabled={!newTag.trim()}
                className="ui-btn ui-btn-primary px-4 py-2 disabled:bg-[rgba(25,40,66,0.8)] disabled:text-faint text-sm font-medium"
              >
                Add
              </button>
            </div>
            {tagsChanged && (
              <button
                onClick={onSaveTags}
                className="mt-4 w-full py-2.5 ui-btn bg-[var(--success)] hover:bg-emerald-300 text-slate-900 text-sm font-semibold rounded-lg transition-colors"
              >
                Save Tags
              </button>
            )}
          </div>

          {/* Metadata */}
          {file.metadata && (
            <>
              <div className="border-t border-gray-800 pt-5 mt-5">
                <h3 className="ui-section-label mb-3">Geometry</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-soft">Triangles</span>
                    <p className="text-slate-100 font-medium">{file.metadata.triangleCount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-soft">Dimensions</span>
                    <p className="text-slate-100 font-medium">
                      {file.metadata.dimensions
                        ? `${file.metadata.dimensions.x} × ${file.metadata.dimensions.y} × ${file.metadata.dimensions.z}`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-soft">Surface Area</span>
                    <p className="text-slate-100 font-medium">{file.metadata.surfaceArea?.toLocaleString()} mm²</p>
                  </div>
                  <div>
                    <span className="text-soft">Watertight</span>
                    <p className={`font-medium ${file.metadata.isWatertight ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {file.metadata.isWatertight ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              </div>

              {file.metadata.printEstimate?.volumeCm3 != null && (
                <div className="border-t border-[rgba(146,173,220,0.18)] pt-5 mt-5">
                  <div className="relative flex items-center justify-between mb-3">
                    <h3 className="ui-section-label">Print Estimate</h3>
                    <button
                      onClick={onTogglePrintSettings}
                      className="p-1 rounded-md ui-btn ui-btn-ghost"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                    {showPrintSettings && (
                      <PrintSettingsPopover
                        onClose={onTogglePrintSettings}
                        onSave={onSavePrintSettings}
                      />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-soft">Volume</span>
                      <p className="text-slate-100 font-medium">{file.metadata.printEstimate.volumeCm3} cm³</p>
                    </div>
                    <div>
                      <span className="text-soft">Est. Weight</span>
                      <p className="text-slate-100 font-medium">~{file.metadata.printEstimate.estimatedGrams}g</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-faint mt-2">Based on current print settings. Rough estimate only.</p>
                </div>
              )}

              <div className="border-t border-[rgba(146,173,220,0.18)] pt-5 mt-5">
                <h3 className="ui-section-label mb-3">File Info</h3>
                <div className="space-y-2 text-sm">
                  {file.metadata.originalFilename && (
                    <div className="flex justify-between">
                      <span className="text-soft">Original</span>
                      <span className="text-slate-200 font-mono text-xs">{file.metadata.originalFilename}</span>
                    </div>
                  )}
                  {file.metadata.headerText && (
                    <div className="flex justify-between">
                      <span className="text-soft">Header</span>
                      <span className="text-slate-200 text-xs truncate max-w-[200px]">{file.metadata.headerText}</span>
                    </div>
                  )}
                  {file.metadata.importedAt && (
                    <div className="flex justify-between">
                      <span className="text-soft">Imported</span>
                      <span className="text-slate-200 text-xs">{new Date(file.metadata.importedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
