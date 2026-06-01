import WebGLBackground from '@shared/WebGLBackground.jsx';
import ApiKeyCard from './ApiKeyCard.jsx';
import ModeCard from './ModeCard.jsx';

export default function Options() {
  return (
    <div className="options-page">
      <WebGLBackground />
      <div className="options-content">

        <header className="options-header">
          <img src="icons/icon-128.png" alt="Small Rock" className="header-icon" />
          <div className="header-text">
            <h1>Small Rock</h1>
            <p>Make everyone a prompt master — one shortcut at a time.</p>
          </div>
        </header>

        <section>
          <div className="section-title">API Key</div>
          <ApiKeyCard />
        </section>

        <section>
          <div className="section-title">Rewrite Modes</div>
          <div className="modes-grid">
            <ModeCard modeId={1} />
            <ModeCard modeId={2} />
            <ModeCard modeId={3} />
          </div>
        </section>

        <section className="glass-card help-section">
          <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '10px' }}>
            How it works
          </strong>
          <p>
            Get a free Gemini key at{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">
              aistudio.google.com/apikey
            </a>.
            Free tier (Gemini 2.5 Flash): 15 req/min, 1,500/day.
          </p>
          <br />
          <p>
            <strong style={{ color: 'var(--text-primary)' }}>Shortcut:</strong>{' '}
            <span className="kbd">Ctrl+M</span> (Win/Linux) or <span className="kbd">Cmd+M</span> (Mac)
            while focused in any chat input.
          </p>
          <p>
            <strong style={{ color: 'var(--text-primary)' }}>Tap count:</strong>{' '}
            ×1 Quick · ×2 Technical · ×3 Planning — tap within 500ms.
          </p>
          <p>
            <strong style={{ color: 'var(--text-primary)' }}>Undo:</strong>{' '}
            <span className="kbd">Esc</span> or <span className="kbd">Ctrl+Z</span> within 30 seconds.
          </p>
          <br />
          <p>
            <strong style={{ color: 'var(--text-primary)' }}>Supported sites:</strong>{' '}
            ChatGPT, Claude, Gemini, Grok, Perplexity, Copilot, Mistral, Poe, DeepSeek, and more.
            To add any site: grant optional permission in{' '}
            <span className="kbd">chrome://extensions</span> → Small Rock → "On all sites".
          </p>
        </section>

      </div>
    </div>
  );
}
