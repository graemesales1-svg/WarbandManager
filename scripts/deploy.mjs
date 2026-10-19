import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Ensure portable git/gh are on PATH if installed in user tools directory
const portableToolsDir = 'C:\\Users\\graem\\.gemini\\antigravity\\brain\\a512c305-d812-4f1d-91ac-4a6d5942b2d4\\scratch\\tools';
if (existsSync(portableToolsDir)) {
  process.env.PATH = `${portableToolsDir}\\git\\cmd;${portableToolsDir}\\gh\\bin;${process.env.PATH || ''}`;
}

const run = (cmd, cwd = process.cwd()) => {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', env: process.env });
};

// 1. Build production bundle into dist/
run('npm run build');

// 2. Initialize temporary git repo inside dist/ and force-push to origin gh-pages branch
const distDir = resolve(process.cwd(), 'dist');
const remoteUrl = execSync('git remote get-url origin', { env: process.env }).toString().trim();

run('git init -b gh-pages', distDir);
run('git config user.name "graemesales1-svg"', distDir);
run('git config user.email "Graeme.sales1@gmail.com"', distDir);
run('git add -A', distDir);
run('git commit -m "Deploy production build to GitHub Pages"', distDir);
run(`git push -f ${remoteUrl} gh-pages:gh-pages`, distDir);

console.log('\n✓ Successfully deployed to https://graemesales1-svg.github.io/WarbandManager/');
