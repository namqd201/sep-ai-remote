import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const rootDir = path.resolve(process.cwd());
const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || os.homedir(), 'AppData', 'Roaming');
const startupDir = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
const startupFilePath = path.join(startupDir, 'SepAiRemote_AutoStart.vbs');

export class AutostartService {
  public static isInstalled(): boolean {
    return fs.existsSync(startupFilePath);
  }

  public static install(): boolean {
    const content = `Set WshShell = CreateObject("WScript.Shell")\r\nWshShell.CurrentDirectory = "${rootDir.replace(/\\/g, '\\\\')}"\r\nWshShell.Run "node scripts/start-all.js", 0, False\r\n`;
    if (!fs.existsSync(startupDir)) {
      fs.mkdirSync(startupDir, { recursive: true });
    }
    fs.writeFileSync(startupFilePath, content, 'utf-8');
    return true;
  }

  public static uninstall(): boolean {
    if (fs.existsSync(startupFilePath)) {
      fs.unlinkSync(startupFilePath);
    }
    return true;
  }
}
