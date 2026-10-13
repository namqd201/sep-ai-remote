import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { TaskStatus, getVietnamNowIso } from '@sep-ai/shared';
export class AppDatabase {
    db;
    constructor() {
        const dbDir = path.dirname(path.resolve(config.databaseFile));
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        this.db = new DatabaseSync(path.resolve(config.databaseFile));
        this.initTables();
    }
    initTables() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        role TEXT NOT NULL,
        is_online INTEGER DEFAULT 0,
        last_seen_at TEXT NOT NULL,
        registered_at TEXT NOT NULL,
        fcm_token TEXT
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        idempotency_key TEXT UNIQUE,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        session_id TEXT,
        workspace_path TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        dispatched_at TEXT,
        completed_at TEXT,
        report_json TEXT,
        created_by_device TEXT NOT NULL,
        retry_count INTEGER DEFAULT 0,
        attachments_json TEXT
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        type TEXT NOT NULL,
        task_id TEXT,
        created_at TEXT NOT NULL,
        is_read INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_idempotency ON tasks(idempotency_key);
    `);
        try {
            this.db.exec(`ALTER TABLE tasks ADD COLUMN attachments_json TEXT;`);
        }
        catch (_) {
            // column already exists
        }
        try {
            this.db.exec(`ALTER TABLE tasks ADD COLUMN live_steps_json TEXT;`);
        }
        catch (_) {
            // column already exists
        }
        try {
            this.db.exec(`ALTER TABLE tasks ADD COLUMN current_action TEXT;`);
        }
        catch (_) {
            // column already exists
        }
        try {
            this.db.exec(`ALTER TABLE tasks ADD COLUMN needs_confirmation INTEGER DEFAULT 0;`);
        }
        catch (_) {
            // column already exists
        }
        try {
            this.db.exec(`ALTER TABLE tasks ADD COLUMN proposal_text TEXT;`);
        }
        catch (_) {
            // column already exists
        }
    }
    // --- Device Management ---
    upsertDevice(device) {
        const stmt = this.db.prepare(`
      INSERT INTO devices (id, name, type, role, is_online, last_seen_at, registered_at, fcm_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        role = excluded.role,
        is_online = excluded.is_online,
        last_seen_at = excluded.last_seen_at,
        fcm_token = COALESCE(excluded.fcm_token, devices.fcm_token)
    `);
        stmt.run(device.id, device.name, device.type, device.role, device.isOnline ? 1 : 0, device.lastSeenAt, device.registeredAt, device.fcmToken || null);
    }
    getDevice(id) {
        const stmt = this.db.prepare(`SELECT * FROM devices WHERE id = ?`);
        const row = stmt.get(id);
        if (!row)
            return null;
        return {
            id: row.id,
            name: row.name,
            type: row.type,
            role: row.role,
            isOnline: Boolean(row.is_online),
            lastSeenAt: row.last_seen_at,
            registeredAt: row.registered_at,
            fcmToken: row.fcm_token || undefined
        };
    }
    setDeviceOnline(id, isOnline) {
        const stmt = this.db.prepare(`
      UPDATE devices SET is_online = ?, last_seen_at = ? WHERE id = ?
    `);
        stmt.run(isOnline ? 1 : 0, getVietnamNowIso(), id);
    }
    // --- Task Management ---
    findTaskByIdempotency(key) {
        const stmt = this.db.prepare(`SELECT * FROM tasks WHERE idempotency_key = ?`);
        const row = stmt.get(key);
        return row ? this.mapTask(row) : null;
    }
    getActiveTaskBySession(sessionId) {
        if (sessionId) {
            const stmt = this.db.prepare(`
        SELECT * FROM tasks 
        WHERE session_id = ? AND status IN ('RUNNING', 'DISPATCHED')
        ORDER BY updated_at DESC, created_at DESC LIMIT 1
      `);
            const row = stmt.get(sessionId);
            if (row)
                return this.mapTask(row);
        }
        // Fallback: Tìm task đang chạy gần đây nhất trong toàn hệ thống
        const stmtFallback = this.db.prepare(`
      SELECT * FROM tasks 
      WHERE status IN ('RUNNING', 'DISPATCHED')
      ORDER BY updated_at DESC, created_at DESC LIMIT 1
    `);
        const rowFallback = stmtFallback.get();
        return rowFallback ? this.mapTask(rowFallback) : null;
    }
    getTask(id) {
        const stmt = this.db.prepare(`SELECT * FROM tasks WHERE id = ?`);
        const row = stmt.get(id);
        return row ? this.mapTask(row) : null;
    }
    listTasks(status, limit = 50) {
        let query = `SELECT * FROM tasks`;
        const params = [];
        if (status) {
            query += ` WHERE status = ?`;
            params.push(status);
        }
        query += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);
        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params);
        return rows.map((r) => this.mapTask(r));
    }
    saveTask(task) {
        const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, idempotency_key, title, prompt, session_id, workspace_path,
        status, created_at, updated_at, dispatched_at, completed_at,
        report_json, created_by_device, retry_count, attachments_json,
        live_steps_json, current_action, needs_confirmation, proposal_text
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        updated_at = excluded.updated_at,
        dispatched_at = excluded.dispatched_at,
        completed_at = excluded.completed_at,
        report_json = excluded.report_json,
        retry_count = excluded.retry_count,
        attachments_json = excluded.attachments_json,
        live_steps_json = COALESCE(excluded.live_steps_json, tasks.live_steps_json),
        current_action = COALESCE(excluded.current_action, tasks.current_action),
        needs_confirmation = excluded.needs_confirmation,
        proposal_text = excluded.proposal_text
    `);
        stmt.run(task.id, task.idempotencyKey || null, task.title, task.prompt, task.sessionId || null, task.workspacePath || null, task.status, task.createdAt, task.updatedAt, task.dispatchedAt || null, task.completedAt || null, task.report ? JSON.stringify(task.report) : null, task.createdByDevice, task.retryCount, task.attachments ? JSON.stringify(task.attachments) : null, task.liveSteps ? JSON.stringify(task.liveSteps) : null, task.currentActionText || null, task.needsConfirmation ? 1 : 0, task.proposalText || null);
    }
    getPendingOfflineTasks() {
        const stmt = this.db.prepare(`
      SELECT * FROM tasks WHERE status = ? ORDER BY created_at ASC
    `);
        const rows = stmt.all(TaskStatus.QUEUED_OFFLINE);
        return rows.map((r) => this.mapTask(r));
    }
    getWaitingQueueTasks() {
        const stmt = this.db.prepare(`
      SELECT * FROM tasks 
      WHERE status IN (?, ?) 
      ORDER BY created_at ASC
    `);
        const rows = stmt.all(TaskStatus.PENDING, TaskStatus.QUEUED_OFFLINE);
        return rows.map((r) => this.mapTask(r));
    }
    deleteTask(id) {
        const stmt = this.db.prepare(`DELETE FROM tasks WHERE id = ?`);
        const result = stmt.run(id);
        return Boolean(result.changes && result.changes > 0);
    }
    // --- Notifications ---
    saveNotification(notification) {
        const stmt = this.db.prepare(`
      INSERT INTO notifications (id, title, body, type, task_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(notification.id, notification.title, notification.body, notification.type, notification.taskId || null, notification.createdAt);
    }
    listNotifications(limit = 20) {
        const stmt = this.db.prepare(`
      SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?
    `);
        const rows = stmt.all(limit);
        return rows.map((r) => ({
            id: r.id,
            title: r.title,
            body: r.body,
            type: r.type,
            taskId: r.task_id || undefined,
            createdAt: r.created_at
        }));
    }
    // --- Settings Management ---
    getSetting(key) {
        const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
        const row = stmt.get(key);
        return row ? row.value : null;
    }
    setSetting(key, value) {
        const stmt = this.db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
        stmt.run(key, value);
    }
    getAllSettings() {
        const stmt = this.db.prepare('SELECT key, value FROM settings');
        const rows = stmt.all();
        const result = {};
        for (const r of rows) {
            result[r.key] = r.value;
        }
        return result;
    }
    mapTask(row) {
        return {
            id: row.id,
            idempotencyKey: row.idempotency_key || undefined,
            title: row.title,
            prompt: row.prompt,
            sessionId: row.session_id || undefined,
            workspacePath: row.workspace_path || undefined,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            dispatchedAt: row.dispatched_at || undefined,
            completedAt: row.completed_at || undefined,
            report: row.report_json ? JSON.parse(row.report_json) : undefined,
            createdByDevice: row.created_by_device,
            retryCount: row.retry_count || 0,
            attachments: row.attachments_json ? JSON.parse(row.attachments_json) : undefined,
            liveSteps: row.live_steps_json ? JSON.parse(row.live_steps_json) : undefined,
            currentActionText: row.current_action || undefined,
            needsConfirmation: Boolean(row.needs_confirmation),
            proposalText: row.proposal_text || undefined
        };
    }
}
export const db = new AppDatabase();
//# sourceMappingURL=database.js.map