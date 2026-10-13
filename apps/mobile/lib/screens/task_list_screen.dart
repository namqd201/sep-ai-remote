import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../constants/colors.dart';
import '../providers/app_state.dart';
import '../widgets/status_pill.dart';
import 'task_detail_screen.dart';

class TaskListScreen extends StatefulWidget {
  const TaskListScreen({Key? key}) : super(key: key);

  @override
  State<TaskListScreen> createState() => _TaskListScreenState();
}

class _TaskListScreenState extends State<TaskListScreen> {
  String _selectedFilter = 'ALL';

  final List<Map<String, String>> _filters = [
    {'label': 'Tất cả', 'value': 'ALL'},
    {'label': 'Đang chạy', 'value': 'RUNNING'},
    {'label': 'Hoàn thành', 'value': 'COMPLETED'},
    {'label': 'Hàng đợi Offline', 'value': 'QUEUED_OFFLINE'},
    {'label': 'Chờ duyệt', 'value': 'WAITING_APPROVAL'},
    {'label': 'Thất bại', 'value': 'FAILED'},
  ];

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<AppState>(context);

    final filteredTasks = _selectedFilter == 'ALL'
        ? state.tasks
        : state.tasks.where((t) => t.status == _selectedFilter).toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        title: const Text(
          'Danh sách công việc',
          style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimary),
        ),
      ),
      body: Column(
        children: [
          // Filter Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: _filters.map((f) {
                final isSelected = _selectedFilter == f['value'];
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(f['label']!),
                    selected: isSelected,
                    selectedColor: AppColors.primary,
                    backgroundColor: AppColors.surface,
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : AppColors.textSecondary,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    ),
                    onSelected: (val) {
                      if (val) {
                        setState(() => _selectedFilter = f['value']!);
                      }
                    },
                  ),
                );
              }).toList(),
            ),
          ),

          // Task List
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => state.refreshTasks(),
              child: filteredTasks.isEmpty
                  ? Center(
                      child: Text(
                        'Không có công việc nào trong mục này.',
                        style: const TextStyle(color: AppColors.textMuted),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      itemCount: filteredTasks.length,
                      itemBuilder: (ctx, idx) {
                        final task = filteredTasks[idx];
                        return Card(
                          color: AppColors.surface,
                          margin: const EdgeInsets.only(bottom: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          child: ListTile(
                            contentPadding: const EdgeInsets.all(16),
                            title: Text(
                              task.title,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: AppColors.textPrimary,
                                fontSize: 16,
                              ),
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const SizedBox(height: 6),
                                Text(
                                  task.prompt,
                                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    StatusPill(status: task.status),
                                    const Spacer(),
                                    Text(
                                      task.createdAt.length >= 19
                                          ? task.createdAt.substring(0, 19).replaceAll('T', ' ')
                                          : task.createdAt,
                                      style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => TaskDetailScreen(taskId: task.id),
                                ),
                              );
                            },
                          ),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
