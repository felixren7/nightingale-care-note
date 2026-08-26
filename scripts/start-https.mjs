import 'dotenv/config';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';

const upstreamPort = Number(process.env.UPSTREAM_PORT ?? 3001);
const httpsPort = Number(process.env.HTTPS_PORT ?? 3443);
const host = '127.0.0.1';
const root = process.cwd();
const [key, cert] = await Promise.all([
  readFile(path.resolve(root, 'certs', 'localhost-key.pem')),
  readFile(path.resolve(root, 'certs', 'localhost-cert.pem')),
]);
const next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', host, '--port', String(upstreamPort)], { stdio: 'inherit', env: { ...process.env, PORT: String(upstreamPort), SESSION_COOKIE_SECURE: 'true', APP_ORIGIN: `https://localhost:${httpsPort}` } });
const proxy = https.createServer({ key, cert }, (request, response) => {
  const upstream = http.request({ hostname: host, port: upstreamPort, path: request.url, method: request.method, headers: { ...request.headers, host: `${host}:${upstreamPort}` } }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on('error', () => { response.writeHead(502); response.end('Nightingale upstream is starting. Retry in a moment.'); });
  request.pipe(upstream);
});
proxy.listen(httpsPort, host, () => console.log(`Nightingale HTTPS demo: https://localhost:${httpsPort}`));
const shutdown = () => { proxy.close(); next.kill('SIGTERM'); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
next.on('exit', (code) => { proxy.close(); process.exitCode = code ?? 1; });
