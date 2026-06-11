import Store from 'electron-store';
import { safeStorage } from 'electron';

const DEFAULT_MODES = [
  {
    id: 1,
    name: 'Quick Prompt',
    systemPrompt: `You are a prompt optimizer. Rewrite the user's rough prompt into a structured, professional prompt for an AI assistant.

Use these sections (omit any that genuinely don't apply):
ROLE: who the AI should act as
OBJECTIVE: the concrete goal
CONTEXT: relevant background, constraints, audience
REQUIREMENTS: specific things to include or avoid
OUTPUT FORMAT: structure of the response

Rules:
- Be specific and actionable. No filler. No padding.
- Preserve the user's actual intent. Do not invent constraints they did not imply.
- Match the language of the user's input.
- Output ONLY the rewritten prompt. No preamble, no commentary, no markdown code fences.`,
  },
  {
    id: 2,
    name: 'Technical Deep Dive',
    systemPrompt: `You are a staff-level engineer acting as a prompt sharpener for technical questions. Rewrite the user's rough draft into a precise, well-scoped technical prompt.

Apply this lens when rewriting:
- Establish the system context (language, framework, runtime version, scale constraints)
- State the observable problem, not the assumed solution
- Specify correctness criteria: what does "working" look like measurably?
- Identify edge cases and failure modes worth addressing
- Declare explicit constraints
- Specify the desired output format

Rules:
- Be surgical. No pleasantries or motivational framing.
- Match the language of the user's input.
- Output ONLY the rewritten prompt.`,
  },
  {
    id: 3,
    name: 'Planning Mode',
    systemPrompt: `You are a product and engineering strategist who turns fuzzy ideas into structured execution plans. Rewrite the user's rough draft into a planning-oriented prompt.

The rewritten prompt should guide the AI to produce:
- A clear goal statement with measurable success criteria
- Explicit scope boundaries (in and out)
- A phased or milestone-based breakdown
- Dependencies, risks, and open questions as first-class items
- A summary suitable for async stakeholder review

Rules:
- Request structured output (numbered list, table, or Markdown sections) not prose.
- Match the language of the user's input.
- Output ONLY the rewritten prompt.`,
  },
];

// Hard cap on a system prompt — prevents pathological API-cost blowups (M-3).
const MAX_SYSTEM_PROMPT_CHARS = 4000;

const schema = {
  // Legacy plaintext key — only present on configs created before encryption.
  // Migrated to geminiKeyEnc on first read, then deleted.
  geminiKey:       { type: 'string',  default: '' },
  // DPAPI/Keychain-encrypted API key, base64-encoded. Never plaintext at rest.
  geminiKeyEnc:    { type: 'string',  default: '' },
  modeConfigs:     { type: 'array',   default: DEFAULT_MODES },
  shortcut:        { type: 'string',  default: 'CmdOrCtrl+M' },
  launchAtStartup: { type: 'boolean', default: false },
};

let _store = null;

export function getStore() {
  if (!_store) {
    _store = new Store({ schema });
    if (!_store.get('modeConfigs')?.length) {
      _store.set('modeConfigs', DEFAULT_MODES);
    }
  }
  return _store;
}

// ─── Encrypted API key (safeStorage = DPAPI on Windows, Keychain on macOS) ─────

export function setApiKey(plain) {
  const s = getStore();
  const trimmed = (plain ?? '').trim();
  if (!trimmed) {
    s.delete('geminiKeyEnc');
    s.delete('geminiKey');
    return;
  }
  if (safeStorage.isEncryptionAvailable()) {
    const enc = safeStorage.encryptString(trimmed).toString('base64');
    s.set('geminiKeyEnc', enc);
    s.delete('geminiKey'); // scrub any legacy plaintext
  } else {
    // Last-resort fallback (should not occur on Win/macOS): keep prior behavior.
    s.set('geminiKey', trimmed);
  }
}

export function getApiKey() {
  const s = getStore();
  const enc = s.get('geminiKeyEnc');
  if (enc && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(enc, 'base64'));
    } catch {
      return '';
    }
  }
  // One-time migration of any legacy plaintext key into encrypted storage.
  const legacy = s.get('geminiKey');
  if (legacy) {
    setApiKey(legacy);
    return legacy;
  }
  return '';
}

export function hasApiKey() {
  return getApiKey().length > 0;
}

// Validate + clamp mode configs before persisting (M-3).
export function sanitizeModeConfigs(configs) {
  if (!Array.isArray(configs)) throw new Error('modeConfigs must be an array');
  return configs.slice(0, 3).map((c) => ({
    id: Number(c.id),
    name: String(c.name ?? '').slice(0, 80),
    systemPrompt: String(c.systemPrompt ?? '').slice(0, MAX_SYSTEM_PROMPT_CHARS),
  }));
}

export { DEFAULT_MODES, MAX_SYSTEM_PROMPT_CHARS };
