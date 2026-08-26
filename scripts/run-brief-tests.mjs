import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const port = '3100';
let baseUrl = process.env.NIGHTINGALE_BASE_URL ?? 'http://127.0.0.1:3000';
let server = null;
let serverOutput = '';

try {
  let ready = await fetch(`${baseUrl}/api/session`).then((response) => response.ok).catch(() => false);
  if (!ready) {
    baseUrl = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', port], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: port } });
    server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
    server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });
  }
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server?.exitCode !== null && server) throw new Error(`Test server exited early.\n${serverOutput}`);
    try {
      const response = await fetch(`${baseUrl}/api/session`);
      if (response.ok) { ready = true; break; }
    } catch { /* server is still compiling */ }
    await delay(500);
  }
  if (!ready) throw new Error(`Test server did not become ready.\n${serverOutput}`);
  const tests = spawn('python3', ['-m', 'unittest', 'discover', '-s', 'tests/brief', '-p', 'test_*.py', '-v'], { stdio: 'inherit', env: { ...process.env, NIGHTINGALE_BASE_URL: baseUrl } });
  const exitCode = await new Promise((resolve) => tests.on('exit', resolve));
  if (exitCode !== 0) process.exitCode = Number(exitCode ?? 1);
} finally {
  server?.kill('SIGTERM');
}
