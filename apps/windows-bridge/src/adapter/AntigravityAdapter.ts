import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { IAntigravityAdapter, ActionResult } from './IAntigravityAdapter.js';
import {
  AgentSessionSummary,
  AgentSessionMetadata,
  ProjectGroup,
  SessionStatus,
  TaskReport,
  TaskStatus,
  TaskEvent,
  TaskLiveStep,
  DEFAULT_TTS_COMPLETION_PHRASE,
  getVietnamNowIso,
  getTaskCompletionVoiceText
} from '@sep-ai/shared';

const execFileAsync = promisify(execFile);

export class AntigravityAdapter implements IAntigravityAdapter {
  private dbPath: string;
  private subscribers: Set<(event: TaskEvent) => void> = new Set();
  private liveSubscribers: Set<
    (data: {
      taskId?: string;
      sessionId: string;
      liveSteps: TaskLiveStep[];
      currentActionText: string;
    }) => void
  > = new Set();
  private lastLiveStepCountBySession: Map<string, number> = new Map();
  private lastActionTextBySession: Map<string, string> = new Map();
  private sessionStateCache: Map<string, { status: string; notFullyIdle: boolean }> = new Map();
  private activeTaskBySession: Map<string, { taskId: string; title: string }> = new Map();
  private pollTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.dbPath = path.join(config.antigravityAppDataDir, 'conversation_summaries.db');
  }

  public setActiveTaskForSession(sessionId: string, taskId: string, title?: string): void {
    const existing = this.activeTaskBySession.get(sessionId);
    this.activeTaskBySession.set(sessionId, { taskId, title: title || existing?.title || 'Task' });
  }

  public getActiveTaskForSession(sessionId: string): { taskId: string; title: string } | undefined {
    return this.activeTaskBySession.get(sessionId);
  }

  public clearActiveTaskForSession(sessionId: string): void {
    this.activeTaskBySession.delete(sessionId);
  }

  public async getConnectionStatus(): Promise<{
    isAvailable: boolean;
    hasAgentApi: boolean;
    hasDatabase: boolean;
    activeSessionsCount: number;
    details: string;
  }> {
    const hasAgentApi = fs.existsSync(config.agentapiPath);
    const hasDatabase = fs.existsSync(this.dbPath);
    let activeSessionsCount = 0;

    if (hasDatabase) {
      try {
        const sessions = await this.getAvailableSessions();
        activeSessionsCount = sessions.length;
      } catch (err) {
        console.warn('[Adapter] Lỗi kiểm tra database:', err);
      }
    }

    return {
      isAvailable: hasAgentApi || hasDatabase,
      hasAgentApi,
      hasDatabase,
      activeSessionsCount,
      details: `AgentAPI: ${hasAgentApi ? 'Found' : 'Missing'}, DB: ${hasDatabase ? 'Found' : 'Missing'}`
    };
  }

  public async getAvailableSessions(): Promise<AgentSessionSummary[]> {
    if (!fs.existsSync(this.dbPath)) {
      return [];
    }

    try {
      const db = new DatabaseSync(this.dbPath, { readOnly: true });
      const rows = db
        .prepare(`
          SELECT conversation_id, title, status, not_fully_idle,
                 workspace_uris, last_modified_time, step_count, preview
          FROM conversation_summaries
          ORDER BY last_modified_time DESC
          LIMIT 20
        `)
        .all() as Record<string, unknown>[];

      return rows.map((row) => {
        const rawStatus = (row.status as string) || '';
        const isNotFullyIdle = Boolean(row.not_fully_idle);
        const status =
          rawStatus === 'CASCADE_RUN_STATUS_RUNNING' || isNotFullyIdle
            ? SessionStatus.RUNNING
            : SessionStatus.IDLE;

        let workspacePath: string | undefined;
        let projectName = 'sep-ai-remote';
        try {
          const uris = JSON.parse((row.workspace_uris as string) || '[]');
          if (Array.isArray(uris) && uris.length > 0) {
            workspacePath = decodeURIComponent(uris[0].replace('file:///', ''));
            const clean = workspacePath.replace(/\\/g, '/');
            const parts = clean.split('/').filter(Boolean);
            projectName = parts[parts.length - 1] || 'sep-ai-remote';
          }
        } catch {
          // ignore parse error
        }

        const lastModified = (row.last_modified_time as string) || new Date().toISOString();
        let timeAgo = '';
        try {
          const diffMs = Date.now() - new Date(lastModified).getTime();
          const diffMin = Math.floor(diffMs / 60000);
          const diffHour = Math.floor(diffMin / 60);
          const diffDay = Math.floor(diffHour / 24);
          const diffMonth = Math.floor(diffDay / 30);
          if (diffMin < 1) timeAgo = 'vừa xong';
          else if (diffMin < 60) timeAgo = `${diffMin}m`;
          else if (diffHour < 24) timeAgo = `${diffHour}h`;
          else if (diffDay < 30) timeAgo = `${diffDay}d`;
          else timeAgo = `${diffMonth}mo`;
        } catch {
          timeAgo = '';
        }

        const rawTitle = ((row.title as string) || '').trim();
        const rawPreview = ((row.preview as string) || '').trim();
        let title = rawTitle;
        if (!title && rawPreview) {
          title = rawPreview.split('\n')[0].trim();
        }
        if (!title) {
          title = 'Untitled Conversation';
        }

        return {
          sessionId: row.conversation_id as string,
          title,
          status,
          isNotFullyIdle,
          workspacePath,
          projectName,
          lastModifiedTime: lastModified,
          timeAgo,
          stepCount: (row.step_count as number) || 0,
          preview: rawPreview || undefined
        };
      });
    } catch (err) {
      console.error('[Adapter] Lỗi đọc conversation_summaries.db:', err);
      return [];
    }
  }

  public async getProjectGroups(): Promise<ProjectGroup[]> {
    const sessions = await this.getAvailableSessions();
    const map = new Map<string, ProjectGroup>();

    for (const s of sessions) {
      if (!map.has(s.projectName)) {
        map.set(s.projectName, {
          projectName: s.projectName,
          workspacePath: s.workspacePath,
          sessions: []
        });
      }
      map.get(s.projectName)!.sessions.push(s);
    }

    return Array.from(map.values());
  }

  private async executeAgentApi(subCommandArgs: string[]): Promise<{ stdout: string; stderr: string }> {
    if (fs.existsSync(config.languageServerExe)) {
      return execFileAsync(config.languageServerExe, ['agentapi', ...subCommandArgs], { shell: false });
    }
    // Fallback qua agentapi.bat
    return execFileAsync(config.agentapiPath, subCommandArgs, { shell: true });
  }

  public async getSessionMetadata(sessionId: string): Promise<ActionResult<AgentSessionMetadata>> {
    if (!fs.existsSync(config.languageServerExe) && !fs.existsSync(config.agentapiPath)) {
      return {
        success: false,
        isUnsupported: true,
        error: 'Không tìm thấy language_server.exe hoặc agentapi.bat trên hệ thống'
      };
    }

    try {
      const { stdout } = await this.executeAgentApi(['get-conversation-metadata', sessionId]);

      const parsed = JSON.parse(stdout);
      const meta = parsed?.response?.conversationMetadata?.metadata;
      if (!meta) {
        return { success: false, error: 'Metadata trả về không hợp lệ' };
      }

      const workspaces = (meta.workspaces || []).map((w: Record<string, unknown>) => ({
        absoluteUri: (w.workspaceFolderAbsoluteUri as string) || '',
        gitRoot: (w.gitRootAbsoluteUri as string) || undefined,
        branchName: (w.branchName as string) || undefined
      }));

      return {
        success: true,
        data: {
          sessionId,
          rootConversationId: meta.rootConversationId || sessionId,
          projectId: meta.projectId,
          workspaces,
          createdAt: meta.createdAt || getVietnamNowIso()
        }
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMsg };
    }
  }

  public async sendMessageToSession(
    sessionId: string,
    message: string,
    title?: string
  ): Promise<ActionResult<{ delivered: boolean }>> {
    if (!fs.existsSync(config.languageServerExe) && !fs.existsSync(config.agentapiPath)) {
      return {
        success: false,
        isUnsupported: true,
        error: 'language_server.exe / agentapi.bat không có sẵn để gửi prompt vào phiên'
      };
    }

    try {
      const args: string[] = ['send-message'];
      if (title) {
        const cleanTitle = title.replace(/[\r\n]+/g, ' ').replace(/"/g, '').substring(0, 60).trim();
        if (cleanTitle) {
          args.push(`--title=${cleanTitle}`);
        }
      }
      args.push(sessionId, message);

      const { stdout, stderr } = await this.executeAgentApi(args);
      console.log(`[Adapter] Đã gửi message tới session ${sessionId}:`, stdout.trim() || stderr.trim());

      return {
        success: true,
        data: { delivered: true }
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Adapter] Lỗi gửi message tới session ${sessionId}:`, errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  public async createNewSession(
    prompt: string,
    title?: string,
    model?: 'flash_lite' | 'flash' | 'pro'
  ): Promise<ActionResult<{ sessionId?: string; output: string }>> {
    if (!fs.existsSync(config.languageServerExe) && !fs.existsSync(config.agentapiPath)) {
      return {
        success: false,
        isUnsupported: true,
        error: 'language_server.exe / agentapi.bat không có sẵn để tạo phiên mới'
      };
    }

    try {
      const args: string[] = ['new-conversation'];
      if (model) args.push(`--model=${model}`);
      if (title) {
        const cleanTitle = title.replace(/[\r\n]+/g, ' ').replace(/"/g, '').substring(0, 60).trim();
        if (cleanTitle) {
          args.push(`--title=${cleanTitle}`);
        }
      }
      args.push(prompt);

      const { stdout } = await this.executeAgentApi(args);
      return {
        success: true,
        data: { output: stdout.trim() }
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMsg };
    }
  }

  public async getTaskStatus(sessionId: string): Promise<TaskStatus> {
    const sessions = await this.getAvailableSessions();
    const session = sessions.find((s) => s.sessionId === sessionId);
    if (!session) return TaskStatus.PENDING;

    if (session.status === SessionStatus.RUNNING || session.isNotFullyIdle) {
      return TaskStatus.RUNNING;
    }
    return TaskStatus.COMPLETED;
  }

  public async getTaskReport(sessionId: string): Promise<TaskReport> {
    const now = new Date().toISOString();
    let summary = 'Task đã kết thúc.';
    const filesModified: string[] = [];
    let testResults: string | undefined;
    let errorDetails: string | undefined;

    // 1. Đọc transcript.jsonl nếu có
    const transcriptPath = path.join(
      config.antigravityAppDataDir,
      'brain',
      sessionId,
      '.system_generated',
      'logs',
      'transcript.jsonl'
    );

    if (fs.existsSync(transcriptPath)) {
      try {
        const content = fs.readFileSync(transcriptPath, 'utf-8');
        const lines = content.trim().split('\n');
        const recentLines = lines.slice(-25);

        for (const line of recentLines) {
          try {
            const step = JSON.parse(line);
            if (step.tool_calls && Array.isArray(step.tool_calls)) {
              for (const call of step.tool_calls) {
                if (call.name === 'write_to_file' || call.name === 'replace_file_content') {
                  const target = call.args?.TargetFile;
                  if (target && !filesModified.includes(target)) {
                    filesModified.push(target);
                  }
                }
              }
            }
            if (step.type === 'PLANNER_RESPONSE' && step.content) {
              summary = step.content.substring(0, 300);
            }
            if (step.status === 'ERROR') {
              errorDetails = step.content || 'Gặp lỗi trong quá trình thực thi tool.';
            }
          } catch {
            // ignore JSON parse line
          }
        }
      } catch (err) {
        console.warn('[Adapter] Lỗi đọc transcript.jsonl:', err);
      }
    }

    // 2. Đọc artifacts report nếu có
    const brainDir = path.join(config.antigravityAppDataDir, 'brain', sessionId);
    if (fs.existsSync(brainDir)) {
      try {
        const files = fs.readdirSync(brainDir);
        const mdFiles = files.filter((f) => f.endsWith('.md'));
        if (mdFiles.length > 0) {
          const latestMd = path.join(brainDir, mdFiles[0]);
          const mdContent = fs.readFileSync(latestMd, 'utf-8');
          summary = mdContent.split('\n').slice(0, 5).join(' ');
        }
      } catch {
        // ignore
      }
    }

    const activeInfo = this.activeTaskBySession.get(sessionId);
    const voiceNotificationText = getTaskCompletionVoiceText(activeInfo?.title);

    return {
      summary,
      filesModified,
      testResults,
      errorDetails,
      voiceNotificationText,
      completedAt: getVietnamNowIso()
    };
  }

  public subscribeToTaskEvents(callback: (event: TaskEvent) => void): () => void {
    this.subscribers.add(callback);

    if (!this.pollTimer) {
      this.startPollingObserver();
    }

    return () => {
      this.subscribers.delete(callback);
      if (this.subscribers.size === 0 && this.liveSubscribers.size === 0 && this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    };
  }

  public subscribeToLiveSteps(
    callback: (data: {
      taskId?: string;
      sessionId: string;
      liveSteps: TaskLiveStep[];
      currentActionText: string;
    }) => void
  ): () => void {
    this.liveSubscribers.add(callback);

    if (!this.pollTimer) {
      this.startPollingObserver();
    }

    return () => {
      this.liveSubscribers.delete(callback);
      if (this.subscribers.size === 0 && this.liveSubscribers.size === 0 && this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    };
  }

  public getSessionLiveSteps(sessionId: string): {
    liveSteps: TaskLiveStep[];
    currentActionText: string;
    isWorking: boolean;
  } {
    const transcriptPath = path.join(
      config.antigravityAppDataDir,
      'brain',
      sessionId,
      '.system_generated',
      'logs',
      'transcript.jsonl'
    );

    const liveSteps: TaskLiveStep[] = [];
    let currentActionText = '';
    let isWorking = false;

    if (!fs.existsSync(transcriptPath)) {
      return { liveSteps, currentActionText, isWorking };
    }

    try {
      const content = fs.readFileSync(transcriptPath, 'utf-8');
      const lines = content.trim().split('\n');
      const recentLines = lines.slice(-40);

      let stepCounter = 1;
      for (const line of recentLines) {
        if (!line.trim()) continue;
        try {
          const step = JSON.parse(line);
          const timestamp = step.created_at || new Date().toISOString();

          if (step.tool_calls && Array.isArray(step.tool_calls)) {
            for (const call of step.tool_calls) {
              const toolName = call.name || 'tool';
              const args = call.args || {};

              let title = args.toolSummary || args.toolAction || toolName;
              if (typeof title === 'string') {
                title = title.replace(/^"|"$/g, '').trim();
              }

              let detail = '';
              let type: TaskLiveStep['type'] = 'tool_call';

              if (toolName === 'view_file') {
                type = 'file_read';
                const filePath = (args.AbsolutePath || '').replace(/^"|"$/g, '');
                const fileName = path.basename(filePath);
                const lineRange = args.StartLine ? `#L${args.StartLine}-${args.EndLine || args.StartLine}` : '';
                detail = `${fileName} ${lineRange}`.trim();
              } else if (toolName === 'replace_file_content' || toolName === 'write_to_file') {
                type = 'file_edit';
                const filePath = (args.TargetFile || '').replace(/^"|"$/g, '');
                detail = path.basename(filePath);
              } else if (toolName === 'run_command') {
                type = 'command';
                const cmd = (args.CommandLine || '').replace(/^"|"$/g, '');
                detail = cmd.length > 60 ? `${cmd.substring(0, 60)}...` : cmd;
              } else {
                detail = toolName;
              }

              liveSteps.push({
                id: `step_${stepCounter++}`,
                type,
                title,
                detail: detail || undefined,
                status: 'done',
                timestamp
              });
              currentActionText = title;
            }
          }
        } catch (_) {
          // ignore invalid json line
        }
      }

      // Kiểm tra trạng thái session từ cache
      const cached = this.sessionStateCache.get(sessionId);
      if (cached && (cached.status === SessionStatus.RUNNING || cached.notFullyIdle)) {
        isWorking = true;
        liveSteps.push({
          id: `step_${stepCounter++}`,
          type: 'thinking',
          title: 'Working...',
          detail: currentActionText ? `Đang thực thi: ${currentActionText}` : 'Đang xử lý...',
          status: 'running',
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.warn('[Adapter] Lỗi đọc live steps từ transcript.jsonl:', err);
    }

    return { liveSteps, currentActionText, isWorking };
  }

  /**
   * Kiểm tra xem bước cuối của Antigravity có đang chờ xác nhận đề xuất / câu hỏi từ người dùng không
   */
  public checkForConfirmationRequest(sessionId: string): {
    needsConfirmation: boolean;
    proposalText?: string;
  } {
    const transcriptPath = path.join(
      config.antigravityAppDataDir,
      'brain',
      sessionId,
      '.system_generated',
      'logs',
      'transcript.jsonl'
    );

    if (!fs.existsSync(transcriptPath)) {
      return { needsConfirmation: false };
    }

    try {
      const content = fs.readFileSync(transcriptPath, 'utf-8');
      const lines = content.trim().split('\n');
      if (lines.length === 0) return { needsConfirmation: false };

      // Tìm bước gần nhất từ MODEL / PLANNER_RESPONSE
      let lastModelStep: any = null;
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const step = JSON.parse(line);
          if (step.source === 'USER_EXPLICIT' || step.type === 'USER_INPUT') {
            return { needsConfirmation: false };
          }
          if (step.source === 'MODEL' || step.type === 'PLANNER_RESPONSE') {
            lastModelStep = step;
            break;
          }
        } catch {
          // ignore
        }
      }

      if (!lastModelStep) return { needsConfirmation: false };

      // 1. Kiểm tra tool call ask_question
      let hasAskQuestion = false;
      let askQuestionDetails = '';
      if (lastModelStep.tool_calls && Array.isArray(lastModelStep.tool_calls)) {
        for (const call of lastModelStep.tool_calls) {
          if (call.name === 'ask_question') {
            hasAskQuestion = true;
            if (call.args?.questions && Array.isArray(call.args.questions)) {
              askQuestionDetails = call.args.questions
                .map((q: any) => {
                  const opts = Array.isArray(q.options)
                    ? q.options.map((o: string, idx: number) => `  ${idx + 1}. ${o}`).join('\n')
                    : '';
                  return `${q.question || ''}\n${opts}`.trim();
                })
                .join('\n\n');
            }
          }
        }
      }

      const text = (lastModelStep.content || '').trim();

      if (hasAskQuestion) {
        const proposal = [text, askQuestionDetails].filter(Boolean).join('\n\n');
        return {
          needsConfirmation: true,
          proposalText: proposal || 'Antigravity đang chờ xác nhận câu hỏi từ Sếp.'
        };
      }

      // 2. Kiểm tra nếu bước cuối không còn tool nào đang chờ chạy và có nội dung hỏi ý kiến/đề xuất
      const hasOtherTools =
        lastModelStep.tool_calls &&
        Array.isArray(lastModelStep.tool_calls) &&
        lastModelStep.tool_calls.length > 0;

      if (!hasOtherTools && text.length > 0) {
        const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
        const lastPara = paragraphs.length > 0 ? paragraphs[paragraphs.length - 1].trim() : text;

        const isExplicitCompletion =
          /\b(đã hoàn thành|hoàn tất nhiệm vụ|đã hoàn thành xong|đã làm xong|đã triển khai và hoàn thiện|đã xong|hoàn tất)\b/i.test(text);

        const hasQuestionMark = /\?|？/.test(lastPara);
        const hasQuestionWords = /\b(bạn có muốn|anh có muốn|sếp có muốn|sếp thấy sao|sếp nghĩ sao|tiếp tục không|chọn phương án nào|cần sếp duyệt|cần sếp xác nhận|chờ sếp xác nhận|chờ confirm)\b/i.test(lastPara);

        // Nếu có từ khóa hoàn thành rõ ràng và câu cuối không phải câu hỏi cần chọn -> Coi như đã xong
        if (isExplicitCompletion && !hasQuestionMark && !hasQuestionWords) {
          return { needsConfirmation: false };
        }

        const confirmationPatterns = [
          /\?|？/,
          /\b(bạn muốn chọn|anh muốn chọn|sếp muốn chọn|chọn phương án nào|bạn chọn cách nào)\b/i,
          /\b(cần sếp duyệt|cần sếp xác nhận|chờ sếp xác nhận|chờ xác nhận|chờ confirm|vui lòng xác nhận|xin ý kiến)\b/i,
          /\b(bạn có muốn|anh có muốn|sếp có muốn|tiếp tục không)\b/i,
          /\b(should i|would you like|do you want|please confirm|proceed with|approve)\b/i
        ];

        const isAskingConfirmation = confirmationPatterns.some((pattern) => pattern.test(lastPara));

        if (isAskingConfirmation) {
          return {
            needsConfirmation: true,
            proposalText: text
          };
        }
      }

      return { needsConfirmation: false };
    } catch (err) {
      console.warn('[Adapter] Lỗi kiểm tra confirmation request:', err);
      return { needsConfirmation: false };
    }
  }

  /**
   * Phương thức gọi khi HookServer nhận được sự kiện Stop trực tiếp từ Antigravity
   */
  public handleDirectHookStop(payload: {
    conversationId: string;
    terminationReason?: string;
    error?: string;
    fullyIdle?: boolean;
  }): void {
    const sessionId = payload.conversationId;
    console.log(`[Adapter] Nhận trực tiếp Stop Hook từ Antigravity cho session: ${sessionId}`);

    const activeInfo = this.activeTaskBySession.get(sessionId);

    // Kiểm tra xem Antigravity có đang chờ Sếp xác nhận đề xuất không
    const confirmCheck = this.checkForConfirmationRequest(sessionId);
    if (confirmCheck.needsConfirmation && !payload.error) {
      console.log(`[Adapter] Phát hiện yêu cầu xác nhận/đề xuất trên session ${sessionId}`);
      const event: TaskEvent = {
        taskId: activeInfo?.taskId,
        sessionId,
        type: 'needs_confirmation',
        status: TaskStatus.RUNNING,
        needsConfirmation: true,
        proposalText: confirmCheck.proposalText,
        ttsVoiceText: 'sếp ơi, em có đề xuất xử lý task như này ạ. Sếp vào đọc và confirm giúp em để em làm nhé',
        timestamp: getVietnamNowIso()
      };

      for (const sub of this.subscribers) {
        sub(event);
      }
      return;
    }

    this.getTaskReport(sessionId).then((report) => {
      if (payload.error) {
        report.errorDetails = payload.error;
      }

      const event: TaskEvent = {
        taskId: activeInfo?.taskId,
        sessionId,
        type: payload.error ? 'failed' : 'completed',
        status: payload.error ? TaskStatus.FAILED : TaskStatus.COMPLETED,
        report,
        timestamp: getVietnamNowIso()
      };

      this.clearActiveTaskForSession(sessionId);
      this.lastLiveStepCountBySession.delete(sessionId);
      this.lastActionTextBySession.delete(sessionId);

      for (const sub of this.subscribers) {
        sub(event);
      }
    });
  }

  private startPollingObserver(): void {
    this.pollTimer = setInterval(async () => {
      try {
        const sessions = await this.getAvailableSessions();
        for (const session of sessions) {
          const prev = this.sessionStateCache.get(session.sessionId);
          const currentStatus = session.status;
          const currentNotFullyIdle = session.isNotFullyIdle;

          if (prev) {
            // Phát hiện chuyển từ RUNNING sang IDLE
            if (
              (prev.status === SessionStatus.RUNNING || prev.notFullyIdle) &&
              currentStatus === SessionStatus.IDLE &&
              !currentNotFullyIdle
            ) {
              const activeInfo = this.activeTaskBySession.get(session.sessionId);
              const confirmCheck = this.checkForConfirmationRequest(session.sessionId);

              if (confirmCheck.needsConfirmation) {
                console.log(`[Adapter] Phát hiện yêu cầu xác nhận/đề xuất trên session ${session.sessionId}`);
                const event: TaskEvent = {
                  taskId: activeInfo?.taskId,
                  sessionId: session.sessionId,
                  type: 'needs_confirmation',
                  status: TaskStatus.RUNNING,
                  needsConfirmation: true,
                  proposalText: confirmCheck.proposalText,
                  ttsVoiceText: 'sếp ơi, em có đề xuất xử lý task như này ạ. Sếp vào đọc và confirm giúp em để em làm nhé',
                  timestamp: getVietnamNowIso()
                };

                for (const sub of this.subscribers) {
                  sub(event);
                }
              } else {
                console.log(`[Adapter] Phát hiện task hoàn thành trên session ${session.sessionId}`);
                const report = await this.getTaskReport(session.sessionId);

                const event: TaskEvent = {
                  taskId: activeInfo?.taskId,
                  sessionId: session.sessionId,
                  type: 'completed',
                  status: TaskStatus.COMPLETED,
                  report,
                  timestamp: getVietnamNowIso()
                };

                this.clearActiveTaskForSession(session.sessionId);
                this.lastLiveStepCountBySession.delete(session.sessionId);
                this.lastActionTextBySession.delete(session.sessionId);

                for (const sub of this.subscribers) {
                  sub(event);
                }
              }
            } else if (
              prev.status === SessionStatus.IDLE &&
              (currentStatus === SessionStatus.RUNNING || currentNotFullyIdle)
            ) {
              console.log(`[Adapter] Phát hiện task đang chạy trên session ${session.sessionId}`);
              const activeInfo = this.activeTaskBySession.get(session.sessionId);
              const event: TaskEvent = {
                taskId: activeInfo?.taskId,
                sessionId: session.sessionId,
                type: 'status_changed',
                status: TaskStatus.RUNNING,
                timestamp: getVietnamNowIso()
              };

              for (const sub of this.subscribers) {
                sub(event);
              }
            }
          }

          this.sessionStateCache.set(session.sessionId, {
            status: currentStatus,
            notFullyIdle: currentNotFullyIdle
          });

          // Cập nhật real-time các bước hành động (live steps) nếu session đang chạy hoặc có active task
          const isActivelyWorking =
            currentStatus === SessionStatus.RUNNING ||
            currentNotFullyIdle ||
            this.activeTaskBySession.has(session.sessionId);

          if (isActivelyWorking) {
            const { liveSteps, currentActionText } = this.getSessionLiveSteps(session.sessionId);
            const prevCount = this.lastLiveStepCountBySession.get(session.sessionId) || 0;
            const prevAction = this.lastActionTextBySession.get(session.sessionId) || '';

            if (liveSteps.length !== prevCount || currentActionText !== prevAction) {
              this.lastLiveStepCountBySession.set(session.sessionId, liveSteps.length);
              this.lastActionTextBySession.set(session.sessionId, currentActionText);

              const activeInfo = this.activeTaskBySession.get(session.sessionId);
              for (const sub of this.liveSubscribers) {
                sub({
                  taskId: activeInfo?.taskId,
                  sessionId: session.sessionId,
                  liveSteps,
                  currentActionText: currentActionText || 'Đang xử lý...'
                });
              }
            }
          }
        }
      } catch (err) {
        // ignore polling loop error
      }
    }, config.pollIntervalMs);
    this.pollTimer.unref();
  }
}

export const antigravityAdapter = new AntigravityAdapter();
