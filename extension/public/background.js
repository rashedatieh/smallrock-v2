const GEMINI_MODEL = 'gemini-2.5-flash';
const BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}`;
const TIMEOUT_MS = 15000;
const TAP_WINDOW_MS = 500;

// ─── Default mode configs (inlined to avoid ES module import in service worker) ─
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
- Match the language of the user's input (English in -> English out; Arabic in -> Arabic out).
- Output ONLY the rewritten prompt. No preamble, no commentary, no markdown code fences, no "Here is the rewritten prompt:".`,
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
- Declare explicit constraints (no third-party libs, must be idiomatic, must handle concurrency, etc.)
- Specify the desired output format: code only, code + explanation, decision tree, trade-off table

Rules:
- Be surgical. No pleasantries or motivational framing.
- Preserve the user's technology choices unless clearly underspecified.
- Match the language of the user's input.
- Output ONLY the rewritten prompt. No preamble, no meta-commentary.`,
  },
  {
    id: 3,
    name: 'Planning Mode',
    systemPrompt: `You are a product and engineering strategist who turns fuzzy ideas into structured execution plans. Rewrite the user's rough draft into a planning-oriented prompt that will yield an actionable, structured output.

The rewritten prompt should guide the AI to produce:
- A clear goal statement with measurable success criteria
- Explicit scope boundaries (in and out)
- A phased or milestone-based breakdown
- Dependencies, risks, and open questions as first-class items
- Owners or roles for each work item where applicable
- A summary suitable for async stakeholder review

Rules:
- The rewritten prompt must request structured output (numbered list, table, or Markdown sections) not prose.
- Preserve the user's domain, timeline hints, and any constraints they mentioned.
- Match the language of the user's input.
- Output ONLY the rewritten prompt. No preamble, no meta-commentary.`,
  },
];

// ─── Multi-tap state ──────────────────────────────────────────────────────────
// Service workers in MV3 are kept alive by the open port during a rewrite.
// Between Ctrl+M taps the worker stays active briefly after the command event.
// A kill within the 500ms window is practically impossible in normal usage.
let tapCount = 0;
let tapTimer = null;
let pendingTab = null;

// ─── onCommand ───────────────────────────────────────────────────────────────
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'rewrite-prompt') return;

  let targetTab = tab;
  if (!targetTab?.id) {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    targetTab = active;
  }
  if (!targetTab?.id) {
    console.warn('[SmallRock-bg] no active tab found');
    return;
  }

  tapCount += 1;
  pendingTab = targetTab;
  clearTimeout(tapTimer);

  tapTimer = setTimeout(async () => {
    const mode = Math.min(tapCount, 3);
    const capturedTab = pendingTab;
    tapCount = 0;
    tapTimer = null;
    pendingTab = null;

    console.log('[SmallRock-bg] firing mode', mode, 'on tab', capturedTab.id);
    try {
      await chrome.tabs.sendMessage(capturedTab.id, { type: 'TRIGGER_REWRITE', mode });
    } catch (err) {
      console.warn(
        '[SmallRock-bg] Could not deliver trigger to tab. Content script may not be loaded — refresh the tab.',
        err?.message
      );
    }
  }, TAP_WINDOW_MS);
});

// ─── onInstalled ─────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({ modeConfigs: DEFAULT_MODES });
    chrome.runtime.openOptionsPage();
  }
  if (details.reason === 'update') {
    const { modeConfigs } = await chrome.storage.local.get('modeConfigs');
    if (!modeConfigs?.length) {
      await chrome.storage.local.set({ modeConfigs: DEFAULT_MODES });
    }
  }
});

// ─── One-shot endpoint (options page Test button) ─────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'REWRITE') return;
  const modeId = msg.mode ?? 1;
  rewriteOneShot(msg.text, modeId).then(
    (text) => sendResponse({ ok: true, text }),
    (err)  => sendResponse({ ok: false, error: err?.message || String(err) })
  );
  return true;
});

// ─── Streaming endpoint (in-page shortcut) ───────────────────────────────────
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'rewrite-stream') return;

  const controller = new AbortController();
  let timedOut = false;
  let portOpen = true;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);

  port.onDisconnect.addListener(() => {
    portOpen = false;
    clearTimeout(timer);
    controller.abort();
  });

  port.onMessage.addListener(async (msg) => {
    if (msg?.type !== 'START') return;
    const modeId = msg.mode ?? 1;
    try {
      await streamRewrite(msg.text, modeId, port, controller.signal);
      if (portOpen) port.postMessage({ type: 'DONE' });
    } catch (err) {
      if (!portOpen) return;
      const message = timedOut
        ? `Timed out after ${TIMEOUT_MS / 1000}s`
        : (err?.message || String(err));
      port.postMessage({ type: 'ERROR', message });
    } finally {
      clearTimeout(timer);
    }
  });
});

// ─── Storage helpers ──────────────────────────────────────────────────────────
async function getKeyOrThrow() {
  const { geminiKey } = await chrome.storage.local.get('geminiKey');
  if (!geminiKey) {
    throw new Error('No API key set. Open Small Rock settings and paste a Gemini key.');
  }
  return geminiKey;
}

async function getSystemPrompt(modeId) {
  const { modeConfigs } = await chrome.storage.local.get('modeConfigs');
  const configs = modeConfigs?.length ? modeConfigs : DEFAULT_MODES;
  const config = configs.find((c) => c.id === modeId) ?? configs[0];
  return config.systemPrompt;
}

// ─── Request builder ──────────────────────────────────────────────────────────
function requestBody(text, systemPrompt) {
  return JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 0 },
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',        threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',  threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT',  threshold: 'BLOCK_ONLY_HIGH' },
    ],
  });
}

// ─── One-shot ─────────────────────────────────────────────────────────────────
async function rewriteOneShot(text, modeId = 1) {
  const [key, systemPrompt] = await Promise.all([getKeyOrThrow(), getSystemPrompt(modeId)]);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody(text, systemPrompt),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const out = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!out) throw new Error('Empty response from Gemini');
    return out.trim();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`Timed out after ${TIMEOUT_MS / 1000}s`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Streaming ────────────────────────────────────────────────────────────────
async function streamRewrite(text, modeId = 1, port, signal) {
  const [key, systemPrompt] = await Promise.all([getKeyOrThrow(), getSystemPrompt(modeId)]);

  const url = `${BASE}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
  console.log('[SmallRock-bg] streaming mode', modeId, 'to', url.replace(/key=[^&]+/, 'key=***'));

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: requestBody(text, systemPrompt),
    signal,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let rawSample = '';
  let totalBytes = 0;
  let eventsParsed = 0;
  let emitted = false;
  let lastFinishReason = null;
  let promptBlockReason = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    totalBytes += chunk.length;
    if (rawSample.length < 600) rawSample += chunk;
    buffer += chunk.replace(/\r\n/g, '\n');

    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const eventBlock = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      eventsParsed++;

      const dataLine = eventBlock.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      const json = dataLine.slice(5).trim();
      if (!json || json === '[DONE]') continue;

      let parsed;
      try {
        parsed = JSON.parse(json);
      } catch (e) {
        console.warn('[SmallRock-bg] SSE JSON parse failed:', e?.message, json.slice(0, 120));
        continue;
      }

      if (parsed?.promptFeedback?.blockReason) {
        promptBlockReason = parsed.promptFeedback.blockReason;
      }

      const candidate = parsed?.candidates?.[0];
      if (candidate?.finishReason) lastFinishReason = candidate.finishReason;

      const chunkText = candidate?.content?.parts?.[0]?.text;
      if (chunkText) {
        emitted = true;
        try {
          port.postMessage({ type: 'CHUNK', text: chunkText });
        } catch {
          return;
        }
      }
    }
  }

  console.log('[SmallRock-bg] stream finished. bytes:', totalBytes, 'events:', eventsParsed,
    'emitted:', emitted, 'finishReason:', lastFinishReason, 'promptBlock:', promptBlockReason);
  if (!emitted) console.warn('[SmallRock-bg] raw sample:\n' + rawSample);

  if (emitted) return;

  if (promptBlockReason) {
    throw new Error(`Gemini blocked your prompt (${promptBlockReason}). Try rewording it.`);
  }
  if (lastFinishReason === 'SAFETY') {
    throw new Error('Gemini safety filter blocked the rewrite. Try different wording.');
  }
  if (lastFinishReason === 'RECITATION') {
    throw new Error('Gemini blocked output (recitation/copyright). Try different wording.');
  }

  console.warn('[SmallRock-bg] streaming yielded no text. Falling back to one-shot generateContent.');
  try {
    const fullText = await rewriteOneShot(text, modeId);
    if (fullText) {
      port.postMessage({ type: 'CHUNK', text: fullText });
      return;
    }
  } catch (err) {
    throw new Error(`Stream empty and one-shot fallback also failed: ${err.message}`);
  }

  throw new Error('Empty response from Gemini (no chunks, no fallback output)');
}
