import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const port = '3200';
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: port } });
let output = '';
server.stdout.on('data', (chunk) => { output += chunk.toString(); });
server.stderr.on('data', (chunk) => { output += chunk.toString(); });

const percentile = (values, p) => values[Math.min(values.length - 1, Math.ceil(values.length * p) - 1)];

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Production server exited early.\n${output}`);
    ready = await fetch(`${baseUrl}/api/session`).then((response) => response.ok).catch(() => false);
    if (ready) break;
    await delay(500);
  }
  if (!ready) throw new Error(`Production server did not become ready.\n${output}`);
  const login = await fetch(`${baseUrl}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'user-clinician' }) });
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('Benchmark could not establish a demo session.');
  const request = async () => {
    const start = performance.now();
    const response = await fetch(`${baseUrl}/api/patients/patient-maya/care-note`, { headers: { cookie } });
    if (!response.ok) throw new Error(`Benchmark request failed with ${response.status}.`);
    await response.arrayBuffer();
    return performance.now() - start;
  };
  for (let warmup = 0; warmup < 50; warmup += 1) await request();
  const samples = [];
  for (let batch = 0; batch < 20; batch += 1) samples.push(...await Promise.all(Array.from({ length: 10 }, request)));
  samples.sort((a, b) => a - b);
  const report = {
    measuredAt: new Date().toISOString(),
    machine: `${os.type()} ${os.release()} · ${os.arch()} · ${os.cpus()[0]?.model ?? 'unknown CPU'} · ${Math.round(os.totalmem() / 1024 ** 3)}GB RAM`,
    runtime: process.version,
    endpoint: '/api/patients/patient-maya/care-note',
    data: '2 clinics · 2 patients · seeded encrypted synthetic record',
    warmupRequests: 50,
    measuredRequests: 200,
    concurrency: 10,
    p50Ms: Number(percentile(samples, 0.5).toFixed(2)),
    p95Ms: Number(percentile(samples, 0.95).toFixed(2)),
    maximumMs: Number(samples.at(-1).toFixed(2)),
    targetP95Ms: 300,
    passed: percentile(samples, 0.95) < 300,
  };
  await mkdir(path.resolve(process.cwd(), 'reports'), { recursive: true });
  await writeFile(path.resolve(process.cwd(), 'reports', 'latest-benchmark.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
} finally { server.kill('SIGTERM'); }
