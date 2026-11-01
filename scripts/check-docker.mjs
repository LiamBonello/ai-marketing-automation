import { spawnSync } from 'node:child_process';

function run(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
  });
}

const version = run('docker', ['--version']);
if (version.error || version.status !== 0) {
  console.error('Docker CLI was not found.');
  console.error('Install Docker Desktop for Windows, start it, then rerun npm run db:local:setup.');
  process.exit(1);
}

const info = run('docker', ['info']);
if (info.status !== 0) {
  console.error('Docker is installed, but the Docker Desktop engine is not running.');
  console.error('');
  console.error('On Windows:');
  console.error('  1. Open Start.');
  console.error('  2. Launch Docker Desktop.');
  console.error('  3. Wait until Docker Desktop reports that the engine is running.');
  console.error('  4. Run: docker info');
  console.error('  5. Then rerun: npm run db:local:setup');
  console.error('');
  const stderr = (info.stderr || '').trim();
  if (stderr) console.error(stderr);
  process.exit(1);
}

console.log('Docker engine: OK');
