import React, { useState } from 'react';
import { MATERIALS, getPrintSettings, savePrintSettings } from '../utils/printEstimate';

export default function PrintSettingsPopover({ onClose, onSave }) {
  const [settings, setSettings] = useState(getPrintSettings);

  const handleSave = () => {
    savePrintSettings(settings);
    onSave(settings);
    onClose();
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-64 bg-gray-800 border border-gray-700 rounded-xl shadow-xl p-4 z-50 space-y-4">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
        Print Settings
      </h4>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Material</label>
        <select
          value={settings.material}
          onChange={(e) => setSettings((s) => ({ ...s, material: e.target.value }))}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {Object.entries(MATERIALS).map(([key, { label, density }]) => (
            <option key={key} value={key}>
              {label} ({density} g/cm³)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">
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
          className="w-full accent-blue-500"
        />
      </div>

      <button
        onClick={handleSave}
        className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
      >
        Save Settings
      </button>
    </div>
  );
}
