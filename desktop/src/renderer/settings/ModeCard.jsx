import { useState, useEffect } from 'react';

const DEFAULT_PROMPTS = {
  1: `You are a prompt optimizer. Rewrite the user's rough prompt into a structured, professional prompt for an AI assistant.\n\nUse these sections (omit any that genuinely don't apply):\nROLE: who the AI should act as\nOBJECTIVE: the concrete goal\nCONTEXT: relevant background, constraints, audience\nREQUIREMENTS: specific things to include or avoid\nOUTPUT FORMAT: structure of the response\n\nRules:\n- Be specific and actionable. No filler. No padding.\n- Preserve the user's actual intent.\n- Match the language of the user's input.\n- Output ONLY the rewritten prompt.`,
  2: `You are a staff-level engineer acting as a prompt sharpener for technical questions. Rewrite the user's rough draft into a precise, well-scoped technical prompt.\n\n- Establish the system context (language, framework, runtime version, scale constraints)\n- State the observable problem, not the assumed solution\n- Specify correctness criteria\n- Identify edge cases and failure modes\n- Declare explicit constraints\n- Specify the desired output format\n\nOutput ONLY the rewritten prompt.`,
  3: `You are a product and engineering strategist. Rewrite the user's rough draft into a planning-oriented prompt.\n\nGuide the AI to produce:\n- A clear goal statement with measurable success criteria\n- Explicit scope boundaries\n- A phased or milestone-based breakdown\n- Dependencies, risks, and open questions\n- A summary suitable for async stakeholder review\n\nRequest structured output (numbered list or Markdown sections).\nOutput ONLY the rewritten prompt.`,
};
const DEFAULT_NAMES = { 1: 'Quick Prompt', 2: 'Technical Deep Dive', 3: 'Planning Mode' };
const TAP_LABELS = { 1: 'Ctrl+M ×1', 2: 'Ctrl+M ×2', 3: 'Ctrl+M ×3' };
const TAP_COLORS = {
  1: { bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.3)', text: '#fbbf24' },
  2: { bg: 'rgba(251,146,60,.12)', border: 'rgba(251,146,60,.3)', text: '#fb923c' },
  3: { bg: 'rgba(239,68,68,.12)',  border: 'rgba(239,68,68,.3)',  text: '#f87171' },
};

export default function ModeCard({ modeId }) {
  const [name, setName]     = useState(DEFAULT_NAMES[modeId]);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPTS[modeId]);
  const [saved, setSaved]   = useState(false);
  const [dirty, setDirty]   = useState(false);

  useEffect(() => {
    window.smallrock?.get('modeConfigs').then((configs) => {
      if (!configs?.length) return;
      const c = configs.find((x) => x.id === modeId);
      if (c) { setName(c.name); setPrompt(c.systemPrompt); }
    });
  }, [modeId]);

  const colors = TAP_COLORS[modeId];

  async function save() {
    const configs = (await window.smallrock?.get('modeConfigs')) ?? [];
    const updated = configs.map((c) => c.id === modeId ? { ...c, name, systemPrompt: prompt } : c);
    await window.smallrock?.set('modeConfigs', updated);
    setSaved(true); setDirty(false);
    setTimeout(() => setSaved(false), 2000);
  }

  async function reset() {
    const configs = (await window.smallrock?.get('modeConfigs')) ?? [];
    const updated = configs.map((c) => c.id === modeId ? { ...c, name: DEFAULT_NAMES[modeId], systemPrompt: DEFAULT_PROMPTS[modeId] } : c);
    await window.smallrock?.set('modeConfigs', updated);
    setName(DEFAULT_NAMES[modeId]); setPrompt(DEFAULT_PROMPTS[modeId]);
    setDirty(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ padding: '3px 10px', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '20px', fontSize: '11px', fontWeight: '700', color: colors.text, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
          {TAP_LABELS[modeId]}
        </span>
        <input type="text" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }}
          style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid rgba(245,158,11,.15)', padding: '2px 0', color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', outline: 'none', fontFamily: 'var(--font-sans)' }} />
      </div>
      <textarea value={prompt} rows={7}
        onChange={(e) => { setPrompt(e.target.value); setDirty(true); }}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); save(); } }}
        style={{ width: '100%', background: 'rgba(0,0,0,.3)', border: '1px solid rgba(245,158,11,.15)', borderRadius: '6px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'var(--font-mono)', lineHeight: '1.6', resize: 'vertical', outline: 'none', minHeight: '140px' }} />
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button className="btn btn-accent" onClick={save} disabled={!dirty && !saved} style={{ fontSize: '12px', padding: '7px 16px' }}>
          {saved ? 'Saved ✓' : 'Save'}
        </button>
        <button className="btn btn-primary" onClick={reset} style={{ fontSize: '12px', padding: '7px 14px' }}>
          Reset
        </button>
      </div>
    </div>
  );
}
