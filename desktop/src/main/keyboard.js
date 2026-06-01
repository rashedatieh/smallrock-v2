import { spawn } from 'child_process';

// ─────────────────────────────────────────────────────────────────────────────
// Persistent PowerShell host for low-latency keystroke injection on Windows.
//
// Spawning powershell.exe per action costs ~200-500ms each. We instead keep ONE
// process alive, preload System.Windows.Forms, and stream commands over stdin.
// After warmup, each keystroke batch is a single stdin write + marker read —
// effectively zero process-spawn overhead.
// ─────────────────────────────────────────────────────────────────────────────

const CMD_TIMEOUT_MS = 4000;

let ps = null;
let pending = null;          // { marker, resolve, reject, timer }
let buffer = '';
let counter = 0;
let chain = Promise.resolve();

function startHost() {
  ps = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-'],
    { windowsHide: true }
  );

  // Preload the SendKeys assembly once for the lifetime of the host.
  ps.stdin.write('Add-Type -AssemblyName System.Windows.Forms\n');

  ps.stdout.on('data', onData);
  ps.stderr.on('data', (d) => console.error('[SmallRock-kbd][ps-err]', d.toString().trim()));

  ps.on('exit', (code) => {
    console.warn('[SmallRock-kbd] PowerShell host exited, code:', code);
    ps = null;
    if (pending) {
      clearTimeout(pending.timer);
      const { reject } = pending;
      pending = null;
      reject(new Error('Keyboard host exited unexpectedly'));
    }
  });

  ps.on('error', (err) => {
    console.error('[SmallRock-kbd] PowerShell host error:', err.message);
    ps = null;
  });
}

function onData(chunk) {
  buffer += chunk.toString();
  if (pending && buffer.includes(pending.marker)) {
    clearTimeout(pending.timer);
    const { resolve } = pending;
    pending = null;
    buffer = '';
    resolve();
  }
}

// Runs a single keystroke batch. Serialized via `chain` so commands never
// interleave on the shared stdin.
function execOne(buildCmd) {
  return new Promise((resolve, reject) => {
    if (!ps) startHost();

    const id = ++counter;
    const marker = `SRDONE_${id}`;

    const timer = setTimeout(() => {
      if (pending && pending.marker === marker) {
        pending = null;
        // A hung SendKeys means the host is wedged — kill and respawn.
        try { ps?.kill(); } catch {}
        ps = null;
        reject(new Error('Keyboard command timed out'));
      }
    }, CMD_TIMEOUT_MS);

    pending = { marker, resolve, reject, timer };

    const cmd = buildCmd(id) + `Write-Output '${marker}'\n`;
    try {
      ps.stdin.write(cmd);
    } catch (err) {
      clearTimeout(timer);
      pending = null;
      reject(err);
    }
  });
}

function run(buildCmd) {
  const p = chain.then(() => execOne(buildCmd));
  chain = p.catch(() => {}); // keep the chain alive even if one command fails
  return p;
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Strict allowlist of permitted SendKeys tokens. Even though every caller today
// passes hardcoded literals, this guarantees no untrusted string can ever be
// interpolated into the PowerShell command — eliminating any future injection
// path by construction (M-2).
const ALLOWED_KEYS = new Set(['^a', '^c', '^v', '{ESC}', '{ENTER}']);

/**
 * Send a sequence of SendKeys tokens with inter-step delays.
 * @param {Array<{keys: string, delayAfterMs?: number}>} steps
 */
export function sendKeySequence(steps) {
  for (const step of steps) {
    if (!ALLOWED_KEYS.has(step.keys)) {
      throw new Error(`Disallowed SendKeys token: ${JSON.stringify(step.keys)}`);
    }
    if (step.delayAfterMs !== undefined &&
        (!Number.isInteger(step.delayAfterMs) || step.delayAfterMs < 0 || step.delayAfterMs > 5000)) {
      throw new Error('Invalid delayAfterMs');
    }
  }
  return run((/* id */) => {
    let cmd = '';
    for (const step of steps) {
      // Token is allowlisted above; delay is a validated integer. Safe to embed.
      cmd += `[System.Windows.Forms.SendKeys]::SendWait('${step.keys}');`;
      if (step.delayAfterMs) cmd += `Start-Sleep -Milliseconds ${step.delayAfterMs};`;
    }
    return cmd;
  });
}

/** Pre-spawn and JIT-warm the host so the first real rewrite is fast. */
export async function warmupKeyboard() {
  try {
    if (!ps) startHost();
    // Trivial round-trip forces the assembly load + JIT to complete now.
    await run(() => '');
    console.log('[SmallRock-kbd] keyboard host warm');
  } catch (err) {
    console.warn('[SmallRock-kbd] warmup failed:', err.message);
  }
}

export function shutdownKeyboard() {
  try { ps?.stdin.end(); } catch {}
  try { ps?.kill(); } catch {}
  ps = null;
}
