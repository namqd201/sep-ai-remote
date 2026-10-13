import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../constants/colors.dart';
import '../providers/app_state.dart';
import '../services/tts_service.dart';
import '../widgets/status_pill.dart';
import 'chat_screen.dart';

class TaskDetailScreen extends StatelessWidget {
  final String taskId;

  const TaskDetailScreen({Key? key, required this.taskId}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<AppState>(context);
    final task = state.tasks.firstWhere(
      (t) => t.id == taskId,
      orElse: () => state.tasks.isNotEmpty ? state.tasks.first : throw Exception('Task not found'),
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: const Text('Chi tiết công việc', style: TextStyle(color: AppColors.textPrimary)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Header Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        task.title,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    StatusPill(status: task.status),
                  ],
                ),
                const SizedBox(height: 12),
                const Text('YÊU CẦU BAN ĐẦU:', style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text(task.prompt, style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
                const SizedBox(height: 12),
                if (task.sessionId != null) ...[
                  const Text('PHIÊN LÀM VIỆC (SESSION ID):', style: TextStyle(color: AppColors.textMuted, fontSize: 11, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Text(task.sessionId!, style: const TextStyle(color: AppColors.accent, fontSize: 12, fontFamily: 'monospace')),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Báo cáo kết quả
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'BÁO CÁO KẾT QUẢ',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    if (task.report != null)
                      IconButton(
                        icon: const Icon(Icons.volume_up, color: AppColors.accent),
                        tooltip: 'Nghe lại giọng đọc',
                        onPressed: () {
                          ttsService.speak(task.report!.voiceNotificationText);
                        },
                      ),
                  ],
                ),
                const SizedBox(height: 8),

                if (task.report == null)
                  const Text(
                    'Đang chờ báo cáo từ Antigravity...',
                    style: TextStyle(color: AppColors.textMuted, fontStyle: FontStyle.italic),
                  )
                else ...[
                  // Câu thông báo giọng nói
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.accent.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.accent.withOpacity(0.3)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.record_voice_over, color: AppColors.accent, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            task.report!.voiceNotificationText,
                            style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w600, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Tóm tắt
                  const Text('Tóm tắt nội dung:', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                  const SizedBox(height: 4),
                  Text(task.report!.summary, style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
                  const SizedBox(height: 14),

                  // Files đã sửa
                  if (task.report!.filesModified.isNotEmpty) ...[
                    const Text('Các file đã chỉnh sửa:', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                    const SizedBox(height: 6),
                    ...task.report!.filesModified.map((f) => Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Row(
                            children: [
                              const Icon(Icons.insert_drive_file, color: AppColors.info, size: 16),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(f, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13, fontFamily: 'monospace')),
                              ),
                            ],
                          ),
                        )),
                    const SizedBox(height: 14),
                  ],

                  // Kết quả kiểm thử
                  if (task.report!.testResults != null) ...[
                    const Text('Kết quả kiểm thử:', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                    const SizedBox(height: 4),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.background,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        task.report!.testResults!,
                        style: const TextStyle(color: AppColors.success, fontSize: 12, fontFamily: 'monospace'),
                      ),
                    ),
                    const SizedBox(height: 14),
                  ],

                  // Lỗi chi tiết (nếu có)
                  if (task.report!.errorDetails != null) ...[
                    const Text('Chi tiết lỗi:', style: TextStyle(color: AppColors.error, fontSize: 12)),
                    const SizedBox(height: 4),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.error.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        task.report!.errorDetails!,
                        style: const TextStyle(color: AppColors.error, fontSize: 12),
                      ),
                    ),
                  ],
                ],
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Nút Trò chuyện tiếp nối
          ElevatedButton.icon(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ChatScreen(targetSessionId: task.sessionId),
                ),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            icon: const Icon(Icons.chat, color: Colors.white),
            label: const Text(
              'Hội thoại tiếp nối với Agent về task này',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
            ),
          ),
        ],
      ),
    );
  }
}
