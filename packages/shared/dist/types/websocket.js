"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsEventType = void 0;
var WsEventType;
(function (WsEventType) {
    // Client/Bridge Authentication
    WsEventType["AUTHENTICATE"] = "authenticate";
    WsEventType["AUTHENTICATED"] = "authenticated";
    WsEventType["AUTH_ERROR"] = "auth_error";
    // Heartbeat
    WsEventType["PING"] = "ping";
    WsEventType["PONG"] = "pong";
    // Bridge Events
    WsEventType["BRIDGE_STATUS"] = "bridge_status";
    WsEventType["SESSIONS_UPDATED"] = "sessions_updated";
    WsEventType["TASK_EVENT"] = "task_event";
    WsEventType["REPORT_READY"] = "report_ready";
    // Task Events
    WsEventType["NEW_TASK"] = "new_task";
    WsEventType["DISPATCH_TASK"] = "dispatch_task";
    WsEventType["SEND_DIRECTIVE"] = "send_directive";
    WsEventType["TASK_STATUS_UPDATED"] = "task_status_updated";
    WsEventType["TASK_LIVE_STEPS"] = "task_live_steps";
    WsEventType["TASK_COMPLETED"] = "task_completed";
    WsEventType["TASK_FAILED"] = "task_failed";
    WsEventType["APPROVAL_REQUIRED"] = "approval_required";
    WsEventType["TASK_NEEDS_CONFIRMATION"] = "task_needs_confirmation";
    // Chat/Interaction
    WsEventType["CHAT_MESSAGE"] = "chat_message";
    WsEventType["NOTIFICATION"] = "notification";
})(WsEventType || (exports.WsEventType = WsEventType = {}));
//# sourceMappingURL=websocket.js.map