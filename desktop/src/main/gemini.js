import { EventEmitter } from 'events';

const GEMINI_MODEL = 'gemini-2.5-flash';
const BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}`;
const TIMEOUT_MS = 15000;

function buildRequestBody(text, systemPrompt) {
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

export function createRewriteStream(text, systemPrompt, apiKey) {
  const emitter = new EventEmitter();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  async function run() {
    try {
      const url = `${BASE}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: buildRequestBody(text, systemPrompt),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let emitted = false;
      let lastFinishReason = null;
      let promptBlockReason = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);

          const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          const json = dataLine.slice(5).trim();
          if (!json || json === '[DONE]') continue;

          let parsed;
          try { parsed = JSON.parse(json); } catch { continue; }

          if (parsed?.promptFeedback?.blockReason) promptBlockReason = parsed.promptFeedback.blockReason;
          const candidate = parsed?.candidates?.[0];
          if (candidate?.finishReason) lastFinishReason = candidate.finishReason;

          const chunkText = candidate?.content?.parts?.[0]?.text;
          if (chunkText) {
            emitted = true;
            emitter.emit('chunk', chunkText);
          }
        }
      }

      if (!emitted) {
        if (promptBlockReason) throw new Error(`Gemini blocked your prompt (${promptBlockReason}).`);
        if (lastFinishReason === 'SAFETY') throw new Error('Gemini safety filter blocked the rewrite.');
        throw new Error('Empty response from Gemini.');
      }

      emitter.emit('done');
    } catch (err) {
      const msg = err.name === 'AbortError'
        ? `Timed out after ${TIMEOUT_MS / 1000}s`
        : (err?.message || String(err));
      emitter.emit('error', msg);
    } finally {
      clearTimeout(timer);
    }
  }

  run();

  return {
    emitter,
    cancel: () => controller.abort(),
  };
}
