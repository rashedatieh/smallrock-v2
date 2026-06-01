import { useState, useEffect } from 'react';

export default function ApiKeyCard() {
  const [key, setKey]       = useState('');
  const [status, setStatus] = useState({ msg: '', kind: 'ok' });
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    chrome.storage.local.get('geminiKey').then(({ geminiKey }) => {
      if (geminiKey) setKey(geminiKey);
    });
  }, []);

  async function save() {
    const trimmed = key.trim();
    if (!trimmed) { setStatus({ msg: 'Enter a key first.', kind: 'error' }); return; }
    await chrome.storage.local.set({ geminiKey: trimmed });
    setStatus({ msg: 'Saved.', kind: 'ok' });
  }

  async function saveAndTest() {
    const trimmed = key.trim();
    if (!trimmed) { setStatus({ msg: 'Enter a key first.', kind: 'error' }); return; }
    await chrome.storage.local.set({ geminiKey: trimmed });
    setStatus({ msg: 'Testing key against Gemini…', kind: 'ok' });
    setTesting(true);
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'REWRITE',
        mode: 1,
        text: 'help me write a short note thanking a coworker for their help on a project last week',
      });
      if (res?.ok) {
        const preview = res.text.length > 160 ? res.text.slice(0, 160) + '…' : res.text;
        setStatus({ msg: 'Key works. Sample: ' + preview, kind: 'ok' });
      } else {
        setStatus({ msg: 'Failed: ' + (res?.error || 'unknown error'), kind: 'error' });
      }
    } catch (err) {
      setStatus({ msg: 'Failed: ' + err.message, kind: 'error' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="glass-card">
      <label className="key-label" htmlFor="gemini-key">Gemini API Key</label>
      <input
        id="gemini-key"
        className="key-input"
        type="password"
        placeholder="AIza…"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      <p className="key-note">
        Stored locally in your browser only. Only sent to Google's Gemini API.
      </p>
      <div className="key-row">
        <button className="btn btn-primary" onClick={save}>Save</button>
        <button className="btn btn-accent" onClick={saveAndTest} disabled={testing}>
          {testing ? 'Testing…' : 'Save & Test'}
        </button>
      </div>
      {status.msg && (
        <p className={`status-text${status.kind === 'error' ? ' error' : ''}`}>
          {status.msg}
        </p>
      )}
    </div>
  );
}
