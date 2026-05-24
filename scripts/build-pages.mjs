import { copyFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

function run(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child =
      process.platform === 'win32'
        ? spawn('cmd.exe', ['/d', '/s', '/c', [command, ...args].join(' ')], {
            env: { ...process.env, ...env },
            stdio: 'inherit',
          })
        : spawn(command, args, {
            env: { ...process.env, ...env },
            stdio: 'inherit',
          });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

await run('npm', ['run', 'build'], {
  VITE_BASE_PATH: '/ThaiGraphicNovel/',
  VITE_DEFAULT_DEBUG: 'true',
});

await copyFile('dist/index.html', 'dist/404.html');
await writeFile('dist/.nojekyll', '');
