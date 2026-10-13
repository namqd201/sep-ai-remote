class TaskAttachmentModel {
  final String name;
  final String mimeType;
  final String? url;
  final String? localPath;

  TaskAttachmentModel({
    required this.name,
    required this.mimeType,
    this.url,
    this.localPath,
  });

  factory TaskAttachmentModel.fromJson(Map<String, dynamic> json) {
    return TaskAttachmentModel(
      name: json['name'] ?? '',
      mimeType: json['mimeType'] ?? 'image/png',
      url: json['url'],
      localPath: json['localPath'],
    );
  }

  Map<String, dynamic> toJson() => {
    'name': name,
    'mimeType': mimeType,
    if (url != null) 'url': url,
    if (localPath != null) 'localPath': localPath,
  };
}

class TaskReportModel {
  final String summary;
  final List<String> filesModified;
  final String? testResults;
  final String? errorDetails;
  final String voiceNotificationText;
  final String completedAt;

  TaskReportModel({
    required this.summary,
    required this.filesModified,
    this.testResults,
    this.errorDetails,
    required this.voiceNotificationText,
    required this.completedAt,
  });

  factory TaskReportModel.fromJson(Map<String, dynamic> json) {
    return TaskReportModel(
      summary: json['summary'] ?? '',
      filesModified: List<String>.from(json['filesModified'] ?? []),
      testResults: json['testResults'],
      errorDetails: json['errorDetails'],
      voiceNotificationText: json['voiceNotificationText'] ?? 'Đã xong task, Sếp vào kiểm tra đi ạ.',
      completedAt: json['completedAt'] ?? '',
    );
  }
}

class TaskModel {
  final String id;
  final String title;
  final String prompt;
  final String? sessionId;
  final String? workspacePath;
  final String status; // PENDING, QUEUED_OFFLINE, DISPATCHED, RUNNING, COMPLETED, FAILED, WAITING_APPROVAL
  final String createdAt;
  final String updatedAt;
  final String? completedAt;
  final TaskReportModel? report;
  final List<TaskAttachmentModel>? attachments;

  TaskModel({
    required this.id,
    required this.title,
    required this.prompt,
    this.sessionId,
    this.workspacePath,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.completedAt,
    this.report,
    this.attachments,
  });

  factory TaskModel.fromJson(Map<String, dynamic> json) {
    var rawAttachments = json['attachments'] as List<dynamic>?;
    return TaskModel(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      prompt: json['prompt'] ?? '',
      sessionId: json['sessionId'],
      workspacePath: json['workspacePath'],
      status: json['status'] ?? 'PENDING',
      createdAt: json['createdAt'] ?? '',
      updatedAt: json['updatedAt'] ?? '',
      completedAt: json['completedAt'],
      report: json['report'] != null ? TaskReportModel.fromJson(json['report']) : null,
      attachments: rawAttachments != null
          ? rawAttachments.map((a) => TaskAttachmentModel.fromJson(a as Map<String, dynamic>)).toList()
          : null,
    );
  }
}
