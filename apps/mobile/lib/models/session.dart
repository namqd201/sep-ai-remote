class SessionModel {
  final String sessionId;
  final String title;
  final String status; // RUNNING, IDLE, ERROR
  final bool isNotFullyIdle;
  final String? workspacePath;
  final String projectName;
  final String lastModifiedTime;
  final String timeAgo;
  final int stepCount;
  final String? preview;

  SessionModel({
    required this.sessionId,
    required this.title,
    required this.status,
    required this.isNotFullyIdle,
    this.workspacePath,
    this.projectName = 'sep-ai-remote',
    required this.lastModifiedTime,
    this.timeAgo = '',
    required this.stepCount,
    this.preview,
  });

  factory SessionModel.fromJson(Map<String, dynamic> json) {
    return SessionModel(
      sessionId: json['sessionId'] ?? '',
      title: json['title'] ?? 'Untitled Conversation',
      status: json['status'] ?? 'IDLE',
      isNotFullyIdle: json['isNotFullyIdle'] ?? false,
      workspacePath: json['workspacePath'],
      projectName: json['projectName'] ?? 'sep-ai-remote',
      lastModifiedTime: json['lastModifiedTime'] ?? '',
      timeAgo: json['timeAgo'] ?? '',
      stepCount: json['stepCount'] ?? 0,
      preview: json['preview'],
    );
  }
}

class ProjectGroupModel {
  final String projectName;
  final String? workspacePath;
  final List<SessionModel> sessions;

  ProjectGroupModel({
    required this.projectName,
    this.workspacePath,
    required this.sessions,
  });

  factory ProjectGroupModel.fromJson(Map<String, dynamic> json) {
    var rawSessions = json['sessions'] as List<dynamic>? ?? [];
    return ProjectGroupModel(
      projectName: json['projectName'] ?? 'Dự án',
      workspacePath: json['workspacePath'],
      sessions: rawSessions.map((s) => SessionModel.fromJson(s as Map<String, dynamic>)).toList(),
    );
  }
}
