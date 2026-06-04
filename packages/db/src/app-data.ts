import path from 'node:path';
import { homedir } from 'node:os';

const productDirectoryName = 'OpenHub';
const linuxDirectoryName = 'openhub';

export interface AppDataDirectoryInput {
  platform?: NodeJS.Platform;
  homeDirectory?: string;
  env?: Record<string, string | undefined>;
}

export function resolveAppDataDirectory(input: AppDataDirectoryInput = {}): string {
  const platform = input.platform ?? process.platform;
  const homeDirectory = input.homeDirectory ?? homedir();
  const env = input.env ?? process.env;

  if (platform === 'darwin') {
    return path.join(homeDirectory, 'Library', 'Application Support', productDirectoryName);
  }

  if (platform === 'win32') {
    return path.join(env.APPDATA ?? path.join(homeDirectory, 'AppData', 'Roaming'), productDirectoryName);
  }

  return path.join(env.XDG_DATA_HOME ?? path.join(homeDirectory, '.local', 'share'), linuxDirectoryName);
}
