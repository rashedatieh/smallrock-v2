import WebGLBackground from '../shared/WebGLBackground.jsx';
import ApiKeyCard from './ApiKeyCard.jsx';
import ModeCard from './ModeCard.jsx';

export default function Settings() {
  return (
    <div className="settings-page">
      <WebGLBackground />
      <div className="settings-content">
        <header className="header">
          <div>
            <h1>Small Rock</h1>
            <p>Desktop companion — system-wide prompt rewriter.</p>
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

        <section className="glass-card" style={{ fontSize: '12px', lineHeight: '1.8', color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '10px' }}>How it works</strong>
          <p>Press <span className="kbd">Ctrl+M</span> in any app to trigger a rewrite.</p>
          <p>Tap count — <span className="kbd">×1</span> Quick · <span className="kbd">×2</span> Technical · <span className="kbd">×3</span> Planning — tap within 500ms.</p>
          <p style={{ marginTop: '8px' }}>The selected text (or all text in the focused field) is sent to Gemini, rewritten, and pasted back. macOS requires Accessibility permission.</p>
        </section>
      </div>
    </div>
  );
}
