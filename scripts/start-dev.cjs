const { spawn } = require('node:child_process');

const commands = [
  {
    name: 'config-api',
    command: process.execPath,
    args: ['scripts/developer-config-api.cjs']
  },
  {
    name: 'angular',
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['ng', 'serve', '--port', '4300']
  }
];

const children = commands.map(({ name, command, args }) => {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false
  });

  child.stdout.on('data', chunk => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on('data', chunk => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on('error', error => {
    console.error(`[${name}] failed to start:`, error);
    shutdown(1);
  });

  child.on('exit', code => {
    if (code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      shutdown(code || 1);
    }
  });

  return child;
});

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }

  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
