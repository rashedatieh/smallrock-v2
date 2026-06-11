import { useState, useEffect, useCallback } from 'react';
import { DEFAULT_MODES } from '@shared/defaults.js';

const TAP_LABELS = { 1: 'Ctrl+M ×1', 2: 'Ctrl+M ×2', 3: 'Ctrl+M ×3' };
const TAP_COLORS = {
  1: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', text: '#fbbf24' },
  2: { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.3)', text: '#fb923c' },
  3: { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  text: '#f87171' },
};

export default function ModeCard({ modeId }) {
  const def = DEFAULT_MODES.find((m) => m.id === modeId);
  const [name,   setName]   = useState(def?.name ?? '');
  const [prompt, setPrompt] = useState(def?.systemPrompt ?? '');
  const [saved,  setSaved]  = useState(false);
  const [dirty,  setDirty]  = useState(false);

  useEffect(() => {
    chrome.storage.local.get('modeConfigs').then(({ modeConfigs }) => {
      if (!modeConfigs?.length) return;
      const config = modeConfigs.find((c) => c.id === modeId);
      if (config) {
        setName(config.name);
        setPrompt(config.systemPrompt);
      }
    });
  }, [modeId]);

  const colors = TAP_COLORS[modeId];

  async function saveConfig() {
    const { modeConfigs } = await chrome.storage.local.get('modeConfigs');
    const configs = modeConfigs?.length ? [...modeConfigs] : DEFAULT_MODES.map((m) => ({ ...m }));
    const idx = configs.findIndex((c) => c.id === modeId);
    if (idx !== -1) {
      configs[idx] = { id: modeId, name: name.trim() || def.name, systemPrompt: prompt };
    }
    await chrome.storage.local.set({ modeConfigs: configs });
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 2000);
  }

  async function resetToDefault() {
    const { modeConfigs } = await chrome.storage.local.get('modeConfigs');
    const configs = modeConfigs?.length ? [...modeConfigs] : DEFAULT_MODES.map((m) => ({ ...m }));
    const idx = configs.findIndex((c) => c.id === modeId);
    if (idx !== -1) {
      configs[idx] = { ...def };
    }
    await chrome.storage.local.set({ modeConfigs: configs });
    setName(def.name);
    setPrompt(def.systemPrompt);
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      saveConfig();
    }
  }

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{
          padding: '3px 10px',
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: '700',
          color: colors.text,
          fontFamily: 'var(--font-mono)',
          flexShrink: 0,
        }}>
          {TAP_LABELS[modeId]}
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setDirty(true); }}
          placeholder="Mode name"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid rgba(245,158,11,0.15)',
            borderRadius: 0,
            padding: '2px 0',
            color: 'var(--text-primary)',
            fontSize: '14px',
            fontWeight: '600',
            fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
        />
      </div>

      {/* System prompt */}
      <div>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
          System Prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => { setPrompt(e.target.value); setDirty(true); }}
          onKeyDown={handleKeyDown}
          rows={8}
          style={{
            width: '100%',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(245,158,11,0.15)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            color: 'var(--text-primary)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            lineHeight: '1.6',
            resize: 'vertical',
            outline: 'none',
            minHeight: '160px',
          }}
          onFocus={(e) => { e.target.style.borderColor = 'rgba(245,158,11,0.4)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'rgba(245,158,11,0.15)'; }}
        />
        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Ctrl+Enter to save
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          className="btn btn-accent"
          onClick={saveConfig}
          disabled={!dirty && !saved}
          style={{ fontSize: '12px', padding: '7px 16px' }}
        >
          {saved ? 'Saved ✓' : 'Save'}
        </button>
        <button
          className="btn btn-primary"
          onClick={resetToDefault}
          style={{ fontSize: '12px', padding: '7px 14px' }}
        >
          Reset to default
        </button>
      </div>
    </div>
  );
}
