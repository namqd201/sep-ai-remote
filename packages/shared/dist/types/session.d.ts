export declare enum SessionStatus {
    RUNNING = "RUNNING",
    IDLE = "IDLE",
    ERROR = "ERROR"
}
export interface WorkspaceInfo {
    absoluteUri: string;
    gitRoot?: string;
    branchName?: string;
}
export interface AgentSessionSummary {
    sessionId: string;
    title: string;
    status: SessionStatus;
    isNotFullyIdle: boolean;
    workspacePath?: string;
    projectName: string;
    lastModifiedTime: string;
    timeAgo: string;
    stepCount: number;
    preview?: string;
}
export interface ProjectGroup {
    projectName: string;
    workspacePath?: string;
    sessions: AgentSessionSummary[];
}
export interface AgentSessionMetadata {
    sessionId: string;
    rootConversationId: string;
    projectId?: string;
    workspaces: WorkspaceInfo[];
    createdAt: string;
}
//# sourceMappingURL=session.d.ts.map