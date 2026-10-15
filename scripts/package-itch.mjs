// Zips dist/ into infinishoot-itch.zip for an itch.io HTML5 upload.
// Uses bsdtar (built into Windows 10+ and macOS) so zip entries get forward
// slashes; PowerShell's Compress-Archive writes backslashes, which breaks on
// itch.io's servers.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';

const out = 'infinishoot-itch.zip';
if (!existsSync('dist/index.html')) throw new Error('Run "npm run build" first.');
if (existsSync(out)) rmSync(out);

const tar = process.platform === 'win32' ? 'C:\\Windows\\System32\\tar.exe' : 'tar';
const entries = readdirSync('dist');
execFileSync(tar, ['-a', '-cf', out, '-C', 'dist', ...entries], { stdio: 'inherit' });
console.log(`Created ${out} (${entries.join(', ')})`);
