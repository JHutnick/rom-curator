// Dev launcher: builds the electron main/preload once, starts the Vite
// renderer dev server, waits for it to be up, then launches Electron
// pointed at that dev server URL. Re-run after editing electron/ or
// src/main/ files (no watch mode in v1 — keeps the dev loop simple).
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import waitOn from 'wait-on';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

console.log('[dev] building electron main/preload...');
const build = spawnSync(npxCmd, ['tsc', '-p', 'tsconfig.electron.json'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
if (build.status !== 0) {
  console.error('[dev] electron build failed');
  process.exit(build.status ?? 1);
}

console.log('[dev] starting vite dev server...');
const vite = spawn(npxCmd, ['vite'], { cwd: root, stdio: 'inherit', shell: true });

await waitOn({ resources: ['http://localhost:5173'], timeout: 30000 });

console.log('[dev] launching electron...');
const electron = spawn(npxCmd, ['electron', '.'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ELECTRON_RENDERER_URL: 'http://localhost:5173' },
});

electron.on('exit', (code) => {
  vite.kill();
  process.exit(code ?? 0);
});
