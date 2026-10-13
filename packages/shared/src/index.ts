export * from './types/task.js';
export * from './types/session.js';
export * from './types/device.js';
export * from './types/auth.js';
export * from './types/websocket.js';
export * from './utils/date.js';

export const DEFAULT_TTS_COMPLETION_PHRASE =
  'Sếp Nam ơi, em đã làm xong task mà sếp giao rồi. Sếp còn việc gì cần em làm nữa không ạ. Sếp vào kiểm tra task kia nhé.';
export const HOOK_SERVER_DEFAULT_PORT = 59123;
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 5000;
