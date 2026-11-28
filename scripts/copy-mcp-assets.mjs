import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageDirectory = path.join(repositoryRoot, 'packages/mcp');
const distributionDirectory = path.join(packageDirectory, 'dist');

await mkdir(distributionDirectory, { recursive: true });
await Promise.all([
  ['docs/user-guide', 'docs'],
  ['packages/mcp/skills', 'skills'],
].map(async ([source, destination]) => {
  const target = path.join(distributionDirectory, destination);
  await rm(target, { recursive: true, force: true });
  await cp(path.join(repositoryRoot, source), target, { recursive: true });
}));
