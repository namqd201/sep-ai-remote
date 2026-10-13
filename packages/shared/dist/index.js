"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_HEARTBEAT_INTERVAL_MS = exports.HOOK_SERVER_DEFAULT_PORT = exports.DEFAULT_TTS_COMPLETION_PHRASE = void 0;
__exportStar(require("./types/task.js"), exports);
__exportStar(require("./types/session.js"), exports);
__exportStar(require("./types/device.js"), exports);
__exportStar(require("./types/auth.js"), exports);
__exportStar(require("./types/websocket.js"), exports);
__exportStar(require("./utils/date.js"), exports);
exports.DEFAULT_TTS_COMPLETION_PHRASE = 'Sếp Nam ơi, em đã làm xong task mà sếp giao rồi. Sếp còn việc gì cần em làm nữa không ạ. Sếp vào kiểm tra task kia nhé.';
exports.HOOK_SERVER_DEFAULT_PORT = 59123;
exports.DEFAULT_HEARTBEAT_INTERVAL_MS = 5000;
//# sourceMappingURL=index.js.map