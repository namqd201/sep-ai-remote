import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || os.homedir(), 'AppData', 'Roaming');
const startupDir = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
const startupFilePath = path.join(startupDir, 'SepAiRemote_AutoStart.vbs');

export function installAutostart() {
  const content = `Set WshShell = CreateObject("WScript.Shell")\r\nWshShell.CurrentDirectory = "${rootDir.replace(/\\/g, '\\\\')}"\r\nWshShell.Run "node scripts/start-all.js", 0, False\r\n`;
  if (!fs.existsSync(startupDir)) {
    fs.mkdirSync(startupDir, { recursive: true });
  }
  fs.writeFileSync(startupFilePath, content, 'utf-8');
  return true;
}

export function uninstallAutostart() {
  if (fs.existsSync(startupFilePath)) {
    fs.unlinkSync(startupFilePath);
  }
  return true;
}

export function checkAutostart() {
  return fs.existsSync(startupFilePath);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isInstalled = checkAutostart();
  if (process.argv.includes('--uninstall')) {
    uninstallAutostart();
    console.log('✅ Đã gỡ bỏ tự khởi động cùng Windows.');
  } else {
    installAutostart();
    console.log(`✅ Đã kích hoạt tự khởi động ngầm cùng Windows thành công! File: ${startupFilePath}`);
  }
}
