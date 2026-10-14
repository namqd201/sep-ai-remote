import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { Task, TaskStatus, Device, DeviceType, UserRole, getVietnamNowIso } from '@sep-ai/shared';

export class AppDatabase {
  private db: DatabaseSync;

  constructor() {
    const dbDir = path.dirname(path.resolve(config.databaseFile));
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new DatabaseSync(path.resolve(config.databaseFile));
    this.initTables();
    this.cleanupOrphanedTasksOnStartup();
  }

  private initTables(): void {
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
    } catch (_) {
      // column already exists
    }
    try {
      this.db.exec(`ALTER TABLE tasks ADD COLUMN live_steps_json TEXT;`);
    } catch (_) {
      // column already exists
    }
    try {
      this.db.exec(`ALTER TABLE tasks ADD COLUMN current_action TEXT;`);
    } catch (_) {
      // column already exists
    }
    try {
      this.db.exec(`ALTER TABLE tasks ADD COLUMN needs_confirmation INTEGER DEFAULT 0;`);
    } catch (_) {
      // column already exists
    }
    try {
      this.db.exec(`ALTER TABLE tasks ADD COLUMN proposal_text TEXT;`);
    } catch (_) {
      // column already exists
    }
    try {
      this.db.exec(`ALTER TABLE tasks ADD COLUMN start_voice_text TEXT;`);
    } catch (_) {
      // column already exists
    }
    try {
      this.db.exec(`ALTER TABLE tasks ADD COLUMN completion_voice_text TEXT;`);
    } catch (_) {
      // column already exists
    }
  }

  // --- Device Management ---
  public upsertDevice(device: Device): void {
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

    stmt.run(
      device.id,
      device.name,
      device.type,
      device.role,
      device.isOnline ? 1 : 0,
      device.lastSeenAt,
      device.registeredAt,
      device.fcmToken || null
    );
  }

  public getDevice(id: string): Device | null {
    const stmt = this.db.prepare(`SELECT * FROM devices WHERE id = ?`);
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      id: row.id as string,
      name: row.name as string,
      type: row.type as DeviceType,
      role: row.role as UserRole,
      isOnline: Boolean(row.is_online),
      lastSeenAt: row.last_seen_at as string,
      registeredAt: row.registered_at as string,
      fcmToken: (row.fcm_token as string) || undefined
    };
  }

  public setDeviceOnline(id: string, isOnline: boolean): void {
    const stmt = this.db.prepare(`
      UPDATE devices SET is_online = ?, last_seen_at = ? WHERE id = ?
    `);
    stmt.run(isOnline ? 1 : 0, getVietnamNowIso(), id);
  }

  // --- Task Management ---
  public findTaskByIdempotency(key: string): Task | null {
    const stmt = this.db.prepare(`SELECT * FROM tasks WHERE idempotency_key = ?`);
    const row = stmt.get(key) as Record<string, unknown> | undefined;
    return row ? this.mapTask(row) : null;
  }

  public getActiveTaskBySession(sessionId?: string): Task | null {
    if (sessionId) {
      const stmt = this.db.prepare(`
        SELECT * FROM tasks 
        WHERE session_id = ? AND status IN ('RUNNING', 'DISPATCHED')
        ORDER BY updated_at DESC, created_at DESC LIMIT 1
      `);
      const row = stmt.get(sessionId) as Record<string, unknown> | undefined;
      if (row) return this.mapTask(row);
    }

    // Fallback: Tìm task đang chạy gần đây nhất trong toàn hệ thống
    const stmtFallback = this.db.prepare(`
      SELECT * FROM tasks 
      WHERE status IN ('RUNNING', 'DISPATCHED')
      ORDER BY updated_at DESC, created_at DESC LIMIT 1
    `);
    const rowFallback = stmtFallback.get() as Record<string, unknown> | undefined;
    return rowFallback ? this.mapTask(rowFallback) : null;
  }

  public getRunningTasks(): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks 
      WHERE status IN ('RUNNING', 'DISPATCHED')
      ORDER BY created_at ASC
    `);
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map((r) => this.mapTask(r));
  }

  public cleanupOrphanedTasksOnStartup(): void {
    const stmt = this.db.prepare(`
      UPDATE tasks 
      SET status = 'FAILED', 
          updated_at = ?,
          current_action = 'Đã hủy do server khởi động lại'
      WHERE status IN ('RUNNING', 'DISPATCHED')
    `);
    const now = getVietnamNowIso();
    const result = stmt.run(now);
    if (result.changes > 0) {
      console.log(`[Database] Đã giải phóng ${result.changes} task bị treo từ phiên trước khi khởi động.`);
    }
  }

  public cleanupStaleRunningTasks(maxAgeMinutes = 20): number {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();
    const stmt = this.db.prepare(`
      UPDATE tasks 
      SET status = 'FAILED', 
          updated_at = ?,
          current_action = 'Đã hủy vì quá hạn (${maxAgeMinutes} phút không phản hồi)'
      WHERE status IN ('RUNNING', 'DISPATCHED') AND updated_at < ?
    `);
    const now = getVietnamNowIso();
    const result = stmt.run(now, cutoffTime);
    if (result.changes > 0) {
      console.log(`[Database] Đã dọn dẹp ${result.changes} task bị kẹt quá ${maxAgeMinutes} phút.`);
    }
    return Number(result.changes);
  }

  public getTask(id: string): Task | null {
    const stmt = this.db.prepare(`SELECT * FROM tasks WHERE id = ?`);
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? this.mapTask(row) : null;
  }

  public listTasks(status?: TaskStatus, limit = 50): Task[] {
    let query = `SELECT * FROM tasks`;
    const params: (string | number)[] = [];

    if (status) {
      query += ` WHERE status = ?`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return rows.map((r) => this.mapTask(r));
  }

  public saveTask(task: Task): void {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, idempotency_key, title, prompt, session_id, workspace_path,
        status, created_at, updated_at, dispatched_at, completed_at,
        report_json, created_by_device, retry_count, attachments_json,
        live_steps_json, current_action, needs_confirmation, proposal_text,
        start_voice_text, completion_voice_text
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        proposal_text = excluded.proposal_text,
        start_voice_text = COALESCE(excluded.start_voice_text, tasks.start_voice_text),
        completion_voice_text = COALESCE(excluded.completion_voice_text, tasks.completion_voice_text)
    `);

    stmt.run(
      task.id,
      task.idempotencyKey || null,
      task.title,
      task.prompt,
      task.sessionId || null,
      task.workspacePath || null,
      task.status,
      task.createdAt,
      task.updatedAt,
      task.dispatchedAt || null,
      task.completedAt || null,
      task.report ? JSON.stringify(task.report) : null,
      task.createdByDevice,
      task.retryCount,
      task.attachments ? JSON.stringify(task.attachments) : null,
      task.liveSteps ? JSON.stringify(task.liveSteps) : null,
      task.currentActionText || null,
      task.needsConfirmation ? 1 : 0,
      task.proposalText || null,
      task.startVoiceText || null,
      task.completionVoiceText || null
    );
  }

  public getPendingOfflineTasks(): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks WHERE status = ? ORDER BY created_at ASC
    `);
    const rows = stmt.all(TaskStatus.QUEUED_OFFLINE) as Record<string, unknown>[];
    return rows.map((r) => this.mapTask(r));
  }

  public getWaitingQueueTasks(): Task[] {
    const stmt = this.db.prepare(`
      SELECT * FROM tasks 
      WHERE status IN (?, ?) 
      ORDER BY created_at ASC
    `);
    const rows = stmt.all(TaskStatus.PENDING, TaskStatus.QUEUED_OFFLINE) as Record<string, unknown>[];
    return rows.map((r) => this.mapTask(r));
  }

  public deleteTask(id: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM tasks WHERE id = ?`);
    const result = stmt.run(id);
    return Boolean(result.changes && result.changes > 0);
  }

  // --- Notifications ---
  public saveNotification(notification: {
    id: string;
    title: string;
    body: string;
    type: string;
    taskId?: string;
    createdAt: string;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO notifications (id, title, body, type, task_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      notification.id,
      notification.title,
      notification.body,
      notification.type,
      notification.taskId || null,
      notification.createdAt
    );
  }

  public listNotifications(limit = 20): Array<{
    id: string;
    title: string;
    body: string;
    type: string;
    taskId?: string;
    createdAt: string;
  }> {
    const stmt = this.db.prepare(`
      SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?
    `);
    const rows = stmt.all(limit) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: r.id as string,
      title: r.title as string,
      body: r.body as string,
      type: r.type as string,
      taskId: (r.task_id as string) || undefined,
      createdAt: r.created_at as string
    }));
  }

  // --- Settings Management ---
  public getSetting(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  public setSetting(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    stmt.run(key, value);
  }

  public getAllSettings(): Record<string, string> {
    const stmt = this.db.prepare('SELECT key, value FROM settings');
    const rows = stmt.all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    for (const r of rows) {
      result[r.key] = r.value;
    }
    return result;
  }

  private mapTask(row: Record<string, unknown>): Task {
    return {
      id: row.id as string,
      idempotencyKey: (row.idempotency_key as string) || undefined,
      title: row.title as string,
      prompt: row.prompt as string,
      sessionId: (row.session_id as string) || undefined,
      workspacePath: (row.workspace_path as string) || undefined,
      status: row.status as TaskStatus,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      dispatchedAt: (row.dispatched_at as string) || undefined,
      completedAt: (row.completed_at as string) || undefined,
      report: row.report_json ? JSON.parse(row.report_json as string) : undefined,
      createdByDevice: row.created_by_device as string,
      retryCount: (row.retry_count as number) || 0,
      attachments: row.attachments_json ? JSON.parse(row.attachments_json as string) : undefined,
      liveSteps: row.live_steps_json ? JSON.parse(row.live_steps_json as string) : undefined,
      currentActionText: (row.current_action as string) || undefined,
      needsConfirmation: Boolean(row.needs_confirmation),
      proposalText: (row.proposal_text as string) || undefined,
      startVoiceText: (row.start_voice_text as string) || undefined,
      completionVoiceText: (row.completion_voice_text as string) || undefined
    };
  }
}

export const db = new AppDatabase();
