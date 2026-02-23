import { useState, useEffect } from 'react';
import { ArrowLeft, Move, RotateCw, Maximize2, Grid3x3, Save, Loader2, Triangle } from 'lucide-react';
import type { SceneState } from '../../types/scene';

interface SceneToolbarProps {
  sceneState: SceneState;
  isSaving: boolean;
  loadingCount: number;
  totalTriangles: number;
  onBack: () => void;
  onSave: () => void;
  onToggleGrid: () => void;
  onSetGridSize: (size: number) => void;
  onSetTransformMode: (mode: 'translate' | 'rotate' | 'scale') => void;
  onRename: (name: string) => void;
}

const GRID_PRESETS = [
  { label: '12.7 mm (½")', value: 12.7 },
  { label: '25.4 mm (1")', value: 25.4 },
  { label: '50.8 mm (2")', value: 50.8 },
];

const TRIANGLE_BUDGET = 5_000_000;

export function SceneToolbar({
  sceneState, isSaving, loadingCount, totalTriangles,
  onBack, onSave, onToggleGrid, onSetGridSize, onSetTransformMode, onRename,
}: SceneToolbarProps) {
  const { meta, transformMode, isDirty } = sceneState;
  const overBudget = totalTriangles > TRIANGLE_BUDGET;

  const isPreset = GRID_PRESETS.some((p) => p.value === meta.gridSize);
  const selectValue = isPreset ? String(meta.gridSize) : 'custom';
  const [customInput, setCustomInput] = useState(String(meta.gridSize));

  // Keep custom input in sync when gridSize changes externally (e.g. open saved scene)
  useEffect(() => {
    if (!isPreset) setCustomInput(String(meta.gridSize));
  }, [meta.gridSize, isPreset]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === 'custom') {
      setCustomInput(String(meta.gridSize));
    } else {
      onSetGridSize(Number(v));
    }
  };

  const commitCustom = () => {
    const n = parseFloat(customInput);
    if (n > 0) onSetGridSize(n);
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[rgba(146,173,220,0.12)] bg-[rgba(14,22,40,0.85)] backdrop-blur-sm flex-shrink-0">
      <button
        onClick={onBack}
        className="ui-btn ui-btn-ghost p-1.5 flex items-center gap-1.5 text-sm"
        title="Back to library"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline text-xs">Library</span>
      </button>

      <div className="w-px h-5 bg-[rgba(146,173,220,0.2)]" />

      <input
        type="text"
        value={meta.name}
        onChange={(e) => onRename(e.target.value)}
        className="ui-input px-2 py-1 text-sm font-medium min-w-0 w-40"
        aria-label="Scene name"
      />

      <div className="w-px h-5 bg-[rgba(146,173,220,0.2)]" />

      {/* Transform mode buttons */}
      <div className="flex gap-1">
        <button
          onClick={() => onSetTransformMode('translate')}
          title="Move (W)"
          className={`p-1.5 rounded-lg transition-colors ${transformMode === 'translate' ? 'bg-cyan-500/20 text-cyan-300' : 'ui-btn ui-btn-ghost'}`}
        >
          <Move className="w-4 h-4" />
        </button>
        <button
          onClick={() => onSetTransformMode('rotate')}
          title="Rotate (E)"
          className={`p-1.5 rounded-lg transition-colors ${transformMode === 'rotate' ? 'bg-cyan-500/20 text-cyan-300' : 'ui-btn ui-btn-ghost'}`}
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <button
          onClick={() => onSetTransformMode('scale')}
          title="Scale (R)"
          className={`p-1.5 rounded-lg transition-colors ${transformMode === 'scale' ? 'bg-cyan-500/20 text-cyan-300' : 'ui-btn ui-btn-ghost'}`}
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-5 bg-[rgba(146,173,220,0.2)]" />

      {/* Grid toggle + size selector */}
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleGrid}
          title="Toggle grid snap (G)"
          className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs ${meta.gridEnabled ? 'bg-cyan-500/20 text-cyan-300' : 'ui-btn ui-btn-ghost'}`}
        >
          <Grid3x3 className="w-4 h-4" />
          <span className="hidden sm:inline">Grid</span>
        </button>
        <select
          value={selectValue}
          onChange={handleSelectChange}
          title="Grid size"
          className="ui-input text-xs py-1 px-1.5 w-28"
        >
          {GRID_PRESETS.map((p) => (
            <option key={p.value} value={String(p.value)}>{p.label}</option>
          ))}
          <option value="custom">Custom…</option>
        </select>
        {!isPreset && (
          <input
            type="number"
            value={customInput}
            min="0.1"
            step="0.1"
            onChange={(e) => setCustomInput(e.target.value)}
            onBlur={commitCustom}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitCustom(); } }}
            className="ui-input text-xs py-1 px-1.5 w-20"
            title="Custom grid size (mm)"
            placeholder="mm"
          />
        )}
      </div>

      <div className="flex-1" />

      {/* Loading indicator */}
      {loadingCount > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-amber-300">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>{loadingCount} loading</span>
        </div>
      )}

      {/* Triangle count */}
      {totalTriangles > 0 && (
        <div className={`flex items-center gap-1 text-xs ${overBudget ? 'text-red-400' : 'text-faint'}`} title="Total triangle count">
          <Triangle className="w-3 h-3" />
          <span>{(totalTriangles / 1000).toFixed(0)}k{overBudget && ' ⚠'}</span>
        </div>
      )}

      <button
        onClick={onSave}
        disabled={isSaving}
        title="Save scene"
        className={`ui-btn px-3 py-1.5 text-xs flex items-center gap-1.5 ${isDirty ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
      >
        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Save
      </button>
    </div>
  );
}
