import { useState, useEffect } from 'react';

export default function ApiKeyCard() {
  const [key, setKey]         = useState('');
  const [hasKey, setHasKey]   = useState(false);
  const [status, setStatus]   = useState({ msg: '', kind: 'ok' });
  const [testing, setTesting] = useState(false);

  // We never pull the saved key back into the renderer — only whether one exists.
  useEffect(() => {
    window.smallrock?.keyStatus().then((s) => setHasKey(!!s?.hasKey));
  }, []);

  async function save() {
    const t = key.trim();
    if (!t) { setStatus({ msg: 'Enter a key first.', kind: 'error' }); return; }
    await window.smallrock?.setKey(t);
    setHasKey(true);
    setKey('');
    setStatus({ msg: 'Saved securely.', kind: 'ok' });
  }

  async function saveAndTest() {
    const t = key.trim();
    if (t) {
      await window.smallrock?.setKey(t);
      setHasKey(true);
      setKey('');
    } else if (!hasKey) {
      setStatus({ msg: 'Enter a key first.', kind: 'error' });
      return;
    }
    setStatus({ msg: 'Testing…', kind: 'ok' });
    setTesting(true);
    try {
      const res = await window.smallrock?.testKey(
        'help me write a short note thanking a coworker for their help on a project last week', 1
      );
      if (res?.ok) {
        const preview = res.text.length > 160 ? res.text.slice(0, 160) + '…' : res.text;
        setStatus({ msg: 'Key works. Sample: ' + preview, kind: 'ok' });
      } else {
        setStatus({ msg: 'Failed: ' + (res?.error ?? 'unknown'), kind: 'error' });
      }
    } catch (err) {
      setStatus({ msg: 'Failed: ' + err.message, kind: 'error' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="glass-card">
      <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
        Gemini API Key
      </label>
      <input className="key-input" type="password"
        placeholder={hasKey ? '•••••••••• (saved — type to replace)' : 'AIza…'}
        value={key}
        onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} />
      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
        Encrypted at rest with Windows DPAPI. Only ever sent to Google's Gemini API.
      </p>
      <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
        <button className="btn btn-primary" onClick={save}>Save</button>
        <button className="btn btn-accent" onClick={saveAndTest} disabled={testing}>
          {testing ? 'Testing…' : 'Save & Test'}
        </button>
      </div>
      {status.msg && <p className={`status${status.kind === 'error' ? ' error' : ''}`}>{status.msg}</p>}
    </div>
  );
}
