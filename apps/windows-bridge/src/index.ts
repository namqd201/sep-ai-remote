import { antigravityAdapter } from './adapter/AntigravityAdapter.js';
import { hookServer } from './hook/HookServer.js';
import { agentBridge } from './bridge/AgentBridge.js';

async function bootstrap() {
  console.log(`====================================================`);
  console.log(`🤖 SẾP AI REMOTE — WINDOWS AGENT BRIDGE`);
  console.log(`====================================================`);

  const status = await antigravityAdapter.getConnectionStatus();
  console.log(`[Adapter Status]`, status.details);
  console.log(`[Adapter Status] Tìm thấy ${status.activeSessionsCount} phiên Antigravity.`);

  // Khởi động Hook Server
  hookServer.start();

  // Khởi động Bridge kết nối Backend
  await agentBridge.start();
}

bootstrap().catch((err) => {
  console.error('[FATAL] Không thể khởi động Windows Agent Bridge:', err);
  process.exit(1);
});
