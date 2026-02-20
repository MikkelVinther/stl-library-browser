import React, { useState } from 'react';
import { MATERIALS, getPrintSettings, savePrintSettings } from '../utils/printEstimate';
import type { PrintSettings } from '../types/index';

interface PrintSettingsPopoverProps {
  onClose: () => void;
  onSave: (settings: PrintSettings) => void;
}

export default function PrintSettingsPopover({ onClose, onSave }: PrintSettingsPopoverProps) {
  const [settings, setSettings] = useState(getPrintSettings);

  const handleSave = () => {
    savePrintSettings(settings);
    onSave(settings);
    onClose();
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-64 overlay-panel rounded-xl p-4 z-50 space-y-4">
      <h4 className="ui-section-label">
        Print Settings
      </h4>

      <div>
        <label className="text-xs text-soft mb-1 block">Material</label>
        <select
          value={settings.material}
          onChange={(e) => setSettings((s) => ({ ...s, material: e.target.value }))}
          className="ui-input w-full text-sm px-3 py-2"
        >
          {Object.entries(MATERIALS).map(([key, { label, density }]) => (
            <option key={key} value={key}>
              {label} ({density} g/cm³)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-soft mb-1 block">
          Infill: {settings.infillPercent}%
        </label>
        <input
          type="range"
          min="5"
          max="100"
          step="5"
          value={settings.infillPercent}
          onChange={(e) =>
            setSettings((s) => ({ ...s, infillPercent: +e.target.value }))
          }
          className="w-full accent-cyan-300"
        />
      </div>

      <button
        onClick={handleSave}
        className="w-full py-2 ui-btn ui-btn-primary text-xs font-semibold"
      >
        Save Settings
      </button>
    </div>
  );
}
