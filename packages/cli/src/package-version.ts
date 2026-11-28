import { readFileSync } from 'node:fs';

interface PackageManifest {
  version?: unknown;
}

const packageManifestUrl = new URL('../package.json', import.meta.url);
const packageManifest = JSON.parse(readFileSync(packageManifestUrl, 'utf8')) as PackageManifest;

if (typeof packageManifest.version !== 'string' || packageManifest.version.trim() === '') {
  throw new Error(`Missing or invalid package version in ${packageManifestUrl.href}`);
}

export const packageVersion = packageManifest.version;
