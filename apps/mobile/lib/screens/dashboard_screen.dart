import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../constants/colors.dart';
import '../constants/strings.dart';
import '../providers/app_state.dart';
import '../widgets/antigravity_drawer.dart';
import '../widgets/status_pill.dart';
import '../widgets/voice_input_modal.dart';
import 'task_detail_screen.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<AppState>(context);

    return Scaffold(
      backgroundColor: AppColors.background,
      drawer: const AntigravityDrawer(),
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: const Text(
          AppStrings.appName,
          style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimary),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textSecondary),
            onPressed: () => state.refreshAll(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => state.refreshAll(),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // 1. Trạng thái kết nối Máy tính PC
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: state.isPcOnline ? AppColors.success.withOpacity(0.5) : AppColors.error.withOpacity(0.5),
                  width: 1.5,
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: (state.isPcOnline ? AppColors.success : AppColors.error).withOpacity(0.15),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      state.isPcOnline ? Icons.laptop_windows : Icons.cloud_off,
                      color: state.isPcOnline ? AppColors.success : AppColors.error,
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          state.isPcOnline ? AppStrings.pcOnline : AppStrings.pcOffline,
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: state.isPcOnline ? AppColors.success : AppColors.error,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          state.isPcOnline
                              ? 'Thiết bị: ${state.pcHostname} (Antigravity Sẵn sàng)'
                              : 'Mất kết nối máy tính. Task mới sẽ vào hàng đợi.',
                          style: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // 2. Banner Giao Task Nhanh Bằng Giọng Nói
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primaryDark, AppColors.primary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withOpacity(0.3),
                    blurRadius: 15,
                    offset: const Offset(0, 5),
                  )
                ],
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text(
                          'Sếp muốn giao việc gì?',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        SizedBox(height: 6),
                        Text(
                          'Bấm micro để nói tiếng Việt hoặc nhập yêu cầu trực tiếp cho Agent.',
                          style: TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton(
                    onPressed: () {
                      showModalBottomSheet(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: Colors.transparent,
                        builder: (_) => const VoiceInputModal(),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      shape: const CircleBorder(),
                      padding: const EdgeInsets.all(16),
                      backgroundColor: Colors.white,
                    ),
                    child: const Icon(Icons.mic, color: AppColors.primary, size: 30),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // 3. Tiêu đề danh sách công việc gần đây
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Công việc gần đây',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                TextButton(
                  onPressed: () {
                    DefaultTabController.of(context).animateTo(1);
                  },
                  child: const Text('Xem tất cả', style: TextStyle(color: AppColors.accent)),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // 4. Danh sách task gần nhất
            if (state.tasks.isEmpty)
              Container(
                padding: const EdgeInsets.all(32),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Text(
                  'Chưa có task nào. Hãy bấm micro để giao việc!',
                  style: TextStyle(color: AppColors.textMuted),
                ),
              )
            else
              ...state.tasks.take(5).map((task) {
                return Card(
                  color: AppColors.surface,
                  margin: const EdgeInsets.only(bottom: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    title: Text(
                      task.title,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                        fontSize: 15,
                      ),
                    ),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 4),
                        Text(
                          task.prompt,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            StatusPill(status: task.status),
                            const Spacer(),
                            Text(
                              task.createdAt.length >= 16 ? task.createdAt.substring(11, 16) : '',
                              style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                            ),
                          ],
                        ),
                      ],
                    ),
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialUriPageRoute(
                          builder: (_) => TaskDetailScreen(taskId: task.id),
                        ),
                      );
                    },
                  ),
                );
              }).toList(),
          ],
        ),
      ),
    );
  }
}

class MaterialUriPageRoute extends MaterialPageRoute {
  MaterialUriPageRoute({required WidgetBuilder builder}) : super(builder: builder);
}
