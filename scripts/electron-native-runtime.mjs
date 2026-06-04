import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

export async function prepareDevElectronNativeRuntime({
  rootDirectory,
  desktopPackagePath,
  mainDistDirectory,
  electronVersion,
  runtimeExternalDependencies,
  runtimeNativeDependencies
}) {
  const requireFromDesktop = createRequire(desktopPackagePath);
  const destinationNodeModules = path.join(mainDistDirectory, 'node_modules');

  await copyRuntimeExternalDependencies(runtimeExternalDependencies, destinationNodeModules, requireFromDesktop);
  await installElectronNativeRuntime({
    appDirectory: mainDistDirectory,
    electronVersion,
    names: runtimeNativeDependencies
  });

  return path.relative(rootDirectory, destinationNodeModules);
}

export async function copyRuntimeExternalDependencies(names, destinationNodeModules, requireFromDesktop) {
  await mkdir(destinationNodeModules, { recursive: true });
  const copied = new Set();

  for (const name of names) {
    await copyPackageDependency(name, requireFromDesktop, destinationNodeModules, copied);
  }
}

export async function installElectronNativeRuntime({ appDirectory, electronVersion, names }) {
  const prebuildInstall = path.join(appDirectory, 'node_modules/prebuild-install/bin.js');

  for (const name of names) {
    const moduleDirectory = path.join(appDirectory, 'node_modules', ...name.split('/'));
    const result = await spawnForResult(
      'node',
      [
        prebuildInstall,
        '--runtime=electron',
        `--target=${electronVersion}`,
        '--disturl=https://electronjs.org/headers'
      ],
      { cwd: moduleDirectory }
    );

    if (result.code !== 0) {
      throw new Error(`Failed to install Electron native runtime for ${name}:\n${result.output}`);
    }
  }
}

async function copyPackageDependency(name, requester, destinationNodeModules, copied) {
  const packageJsonPath = requester.resolve(`${name}/package.json`);
  const packageDirectory = path.dirname(packageJsonPath);
  const packageJson = await readJson(packageJsonPath);
  const packageKey = `${packageJson.name}@${packageJson.version}`;

  if (copied.has(packageKey)) {
    return;
  }

  copied.add(packageKey);
  const destinationDirectory = path.join(destinationNodeModules, ...packageJson.name.split('/'));

  await rm(destinationDirectory, { recursive: true, force: true });
  await mkdir(path.dirname(destinationDirectory), { recursive: true });
  await cp(packageDirectory, destinationDirectory, {
    recursive: true,
    dereference: true,
    filter: (sourcePath) => {
      const relativePath = path.relative(packageDirectory, sourcePath);
      return relativePath === '' || !isNestedNodeModulesPath(relativePath);
    }
  });

  const packageRequire = createRequire(packageJsonPath);
  const dependencyNames = Object.keys({
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.optionalDependencies ?? {})
  });

  for (const dependencyName of dependencyNames) {
    await copyPackageDependency(dependencyName, packageRequire, destinationNodeModules, copied);
  }
}

function isNestedNodeModulesPath(relativePath) {
  return relativePath === 'node_modules' || relativePath.startsWith(`node_modules${path.sep}`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function spawnForResult(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code, output });
    });
  });
}
