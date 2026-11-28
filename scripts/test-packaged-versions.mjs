import { spawnSync } from 'node:child_process';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = fileURLToPath(new URL('../', import.meta.url));
const workspacePackagesRoot = join(workspaceRoot, 'packages');
const packageCases = [
  {
    directory: 'cli',
    commands: [
      { name: 'say-coeiroink', entryPoint: './dist/say-coeiroink.js' },
      { name: 'add-character', entryPoint: './dist/add-character.js' },
      { name: 'dictionary-register', entryPoint: './dist/dictionary-register.js' },
    ],
  },
  {
    directory: 'mcp',
    commands: [{ name: 'coeiro-operator', entryPoint: './dist/server.js' }],
  },
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed with exit code ${result.status}\n` +
        `${result.stdout ?? ''}${result.stderr ?? ''}`
    );
  }
  return result.stdout;
}

async function testPackage(packageCase, temporaryRoot) {
  const packageRoot = join(workspacePackagesRoot, packageCase.directory);
  const sourceManifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
  const packageTemporaryRoot = join(temporaryRoot, sourceManifest.name.replaceAll('/', '-'));
  await mkdir(packageTemporaryRoot, { recursive: true });
  run('pnpm', ['pack', '--pack-destination', packageTemporaryRoot], { cwd: packageRoot });

  const tarballs = (await readdir(packageTemporaryRoot)).filter(file => file.endsWith('.tgz'));
  if (tarballs.length !== 1) {
    throw new Error(`Expected one tarball for ${sourceManifest.name}, found ${tarballs.length}`);
  }

  const tarballPath = join(packageTemporaryRoot, tarballs[0]);
  const archiveFiles = run('tar', ['-tzf', tarballPath]).split(/\r?\n/);
  if (!archiveFiles.includes('package/package.json')) {
    throw new Error(`The packed ${sourceManifest.name} does not contain package/package.json`);
  }

  const installRoot = join(packageTemporaryRoot, 'install');
  await mkdir(installRoot, { recursive: true });

  const localPackageOverrides = {};
  for (const entry of await readdir(workspacePackagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const localPackageRoot = join(workspacePackagesRoot, entry.name);
    const localManifest = JSON.parse(
      await readFile(join(localPackageRoot, 'package.json'), 'utf8')
    );
    if (localManifest.name !== sourceManifest.name) {
      localPackageOverrides[localManifest.name] = `link:${localPackageRoot}`;
    }
  }
  for (const dependencyName of Object.keys(sourceManifest.dependencies ?? {})) {
    if (localPackageOverrides[dependencyName]) {
      continue;
    }
    const installedDependencyPath = await realpath(
      join(packageRoot, 'node_modules', ...dependencyName.split('/'))
    );
    localPackageOverrides[dependencyName] = `link:${installedDependencyPath}`;
  }

  await writeFile(
    join(installRoot, 'package.json'),
    JSON.stringify(
      {
        name: 'coeiro-operator-packaged-version-test',
        version: '1.0.0',
        private: true,
        dependencies: {
          [sourceManifest.name]: `file:${tarballPath}`,
        },
        pnpm: {
          overrides: localPackageOverrides,
        },
      },
      null,
      2
    )
  );
  run('pnpm', ['install', '--offline', '--ignore-scripts'], { cwd: installRoot });

  const installedPackageRoot = join(installRoot, 'node_modules', ...sourceManifest.name.split('/'));
  const installedPackageRealPath = await realpath(installedPackageRoot);
  const packagePathFromInstallRoot = relative(
    await realpath(installRoot),
    installedPackageRealPath
  );
  if (isAbsolute(packagePathFromInstallRoot) || packagePathFromInstallRoot.startsWith('..')) {
    throw new Error(
      `${sourceManifest.name} was not installed from the temporary project: ${installedPackageRealPath}`
    );
  }

  const installedManifest = JSON.parse(
    await readFile(join(installedPackageRoot, 'package.json'), 'utf8')
  );
  if (installedManifest.version !== sourceManifest.version) {
    throw new Error(
      `${sourceManifest.name}: packed version ${installedManifest.version} does not match source version ${sourceManifest.version}`
    );
  }

  for (const command of packageCase.commands) {
    const entryPoint = installedManifest.bin[command.name];
    if (entryPoint !== command.entryPoint) {
      throw new Error(
        `${sourceManifest.name}: unexpected ${command.name} bin entry: ${entryPoint}`
      );
    }

    const executablePath = resolve(installedPackageRoot, entryPoint);
    await access(executablePath);
    const workingDirectory = join(packageTemporaryRoot, 'cwd', command.name);
    await mkdir(workingDirectory, { recursive: true });
    const output = run(process.execPath, [executablePath, '--version'], {
      cwd: workingDirectory,
      env: { ...process.env, NODE_ENV: 'production' },
    }).trim();

    if (output !== installedManifest.version) {
      throw new Error(
        `${command.name} printed "${output}", expected packed version "${installedManifest.version}"`
      );
    }
  }

  console.log(
    `${sourceManifest.name} ${installedManifest.version}: ${packageCase.commands
      .map(command => command.name)
      .join(', ')} reported the packed version from separate working directories.`
  );
}

const temporaryRoot = await mkdtemp(join(tmpdir(), 'coeiro-packaged-version-'));
try {
  for (const packageCase of packageCases) {
    await testPackage(packageCase, temporaryRoot);
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
