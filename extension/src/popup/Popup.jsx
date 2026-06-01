import { useState, useEffect } from 'react';
import WebGLBackground from '@shared/WebGLBackground.jsx';
import ModeChip from './ModeChip.jsx';
import { DEFAULT_MODES } from '@shared/defaults.js';

export default function Popup() {
  const [hasKey, setHasKey] = useState(null);
  const [modes, setModes]   = useState(DEFAULT_MODES);

  useEffect(() => {
    chrome.storage.local.get(['geminiKey', 'modeConfigs']).then(({ geminiKey, modeConfigs }) => {
      setHasKey(!!geminiKey);
      if (modeConfigs?.length) setModes(modeConfigs);
    });
  }, []);

  function openOptions(e) {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  }

  return (
    <div className="popup-wrap">
      <WebGLBackground />
      <div className="popup-overlay">
        <div className="brand-row">
          <img src="icons/icon-48.png" alt="Small Rock" className="brand-icon" />
          <span className="brand-name">Small Rock</span>
          <span className="brand-version">v2</span>
        </div>

        {hasKey !== null && (
          <div className={`status-badge ${hasKey ? 'ok' : 'warn'}`}>
            <span className="status-dot" />
            {hasKey ? 'Ready' : 'No API key — open Settings'}
          </div>
        )}

        <div>
          <div className="modes-label" style={{ marginBottom: '6px' }}>Rewrite Modes</div>
          <div className="mode-chips">
            {modes.map((m) => (
              <ModeChip key={m.id} id={m.id} name={m.name} />
            ))}
          </div>
        </div>

        <div className="popup-footer">
          <button className="settings-link" onClick={openOptions}>
            Settings →
          </button>
          <span className="shortcut-hint">
            <span className="kbd">Ctrl+M</span> to rewrite
          </span>
        </div>
      </div>
    </div>
  );
}
