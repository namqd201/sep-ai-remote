import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  backendWsUrl: process.env.BACKEND_WS_URL || 'ws://127.0.0.1:3000/ws',
  backendHttpUrl: process.env.BACKEND_HTTP_URL || 'http://127.0.0.1:3000',
  pairingCode: process.env.BRIDGE_PAIRING_CODE || '888999',
  deviceName: process.env.BRIDGE_DEVICE_NAME || 'Windows_PC_Antigravity',
  hookPort: parseInt(process.env.HOOK_SERVER_PORT || '59123', 10),

  // Antigravity paths on Windows
  antigravityAppDataDir:
    process.env.ANTIGRAVITY_APP_DATA_DIR || 'C:\\Users\\PC\\.gemini\\antigravity',
  agentapiPath:
    process.env.ANTIGRAVITY_AGENTAPI_PATH || 'C:\\Users\\PC\\.gemini\\antigravity\\bin\\agentapi.bat',
  languageServerExe:
    process.env.ANTIGRAVITY_LANGUAGE_SERVER ||
    'C:\\Users\\PC\\AppData\\Local\\Programs\\antigravity\\resources\\bin\\language_server.exe',

  // Intervals
  heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL_MS || '5000', 10),
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '1000', 10)
};
