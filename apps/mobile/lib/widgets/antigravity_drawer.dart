import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../constants/colors.dart';
import '../models/session.dart';
import '../providers/app_state.dart';
import 'voice_input_modal.dart';

class AntigravityDrawer extends StatelessWidget {
  const AntigravityDrawer({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<AppState>(context);

    // Gom nhóm theo dự án (ProjectGroup)
    final Map<String, List<SessionModel>> grouped = {};
    for (final s in state.sessions) {
      grouped.putIfAbsent(s.projectName, () => []).add(s);
    }

    return Drawer(
      backgroundColor: const Color(0xFF14171F),
      child: SafeArea(
        child: Column(
          children: [
            // Header: Logo Antigravity + Tiêu đề
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF3B82F6), Color(0xFF8B5CF6)],
                      ),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    alignment: Alignment.center,
                    child: const Text(
                      'A',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Text(
                    'Antigravity Projects',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.close, color: AppColors.textMuted, size: 20),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            const Divider(color: Colors.white10, height: 1),

            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                children: [
                  // Nút + New Conversation
                  InkWell(
                    onTap: () {
                      Navigator.of(context).pop();
                      showModalBottomSheet(
                        context: context,
                        isScrollControlled: true,
                        backgroundColor: Colors.transparent,
                        builder: (_) => const VoiceInputModal(),
                      );
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.06),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.white12),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.add, color: AppColors.accent, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'New Conversation',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Mục cố định
                  _drawerStaticItem(Icons.history, 'Conversation History'),
                  _drawerStaticItem(Icons.access_time, 'Automations'),
                  _drawerStaticItem(Icons.extension_outlined, 'Customizations'),
                  const SizedBox(height: 12),

                  // Header mục Projects
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'PROJECTS',
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.8,
                          ),
                        ),
                        Row(
                          children: [
                            Icon(Icons.filter_list, color: AppColors.textMuted.withOpacity(0.6), size: 16),
                            const SizedBox(width: 8),
                            Icon(Icons.create_new_folder_outlined, color: AppColors.textMuted.withOpacity(0.6), size: 16),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 4),

                  // Cây dự án & Conversation theo đúng ảnh Antigravity
                  if (grouped.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(12),
                      child: Text(
                        'Đang tải danh sách dự án...',
                        style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                      ),
                    )
                  else
                    ...grouped.entries.map((entry) {
                      final projectName = entry.key;
                      final sessions = entry.value;

                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Thư mục Project
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                              child: Row(
                                children: [
                                  const Icon(Icons.folder_outlined, color: Color(0xFF93C5FD), size: 16),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      projectName,
                                      style: const TextStyle(
                                        color: Color(0xFF93C5FD),
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            // Danh sách Conversations trong Project
                            Container(
                              margin: const EdgeInsets.only(left: 10),
                              padding: const EdgeInsets.only(left: 8),
                              decoration: const BoxDecoration(
                                border: Border(left: BorderSide(color: Colors.white12, width: 1.5)),
                              ),
                              child: Column(
                                children: sessions.map((s) {
                                  final isSelected = s.sessionId == state.selectedSessionId;

                                  return InkWell(
                                    onTap: () {
                                      state.selectedSessionId = s.sessionId;
                                      Navigator.of(context).pop();
                                    },
                                    borderRadius: BorderRadius.circular(8),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                                      margin: const EdgeInsets.symmetric(vertical: 2),
                                      decoration: BoxDecoration(
                                        color: isSelected ? const Color(0xFF1E293B) : Colors.transparent,
                                        borderRadius: BorderRadius.circular(8),
                                        border: isSelected
                                            ? Border.all(color: const Color(0xFF3B82F6).withOpacity(0.5))
                                            : null,
                                      ),
                                      child: Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              s.title,
                                              style: TextStyle(
                                                color: isSelected ? const Color(0xFF60A5FA) : Colors.white,
                                                fontSize: 12.5,
                                                fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                                              ),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                            ),
                                          ),
                                          if (s.timeAgo.isNotEmpty) ...[
                                            const SizedBox(width: 6),
                                            Text(
                                              s.timeAgo,
                                              style: TextStyle(
                                                color: AppColors.textMuted.withOpacity(0.7),
                                                fontSize: 10.5,
                                              ),
                                            ),
                                          ],
                                          if (isSelected) ...[
                                            const SizedBox(width: 4),
                                            const Icon(Icons.more_horiz, color: AppColors.textMuted, size: 14),
                                          ],
                                        ],
                                      ),
                                    ),
                                  );
                                }).toList(),
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _drawerStaticItem(IconData icon, String label) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      child: Row(
        children: [
          Icon(icon, color: AppColors.textMuted, size: 18),
          const SizedBox(width: 10),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.textMuted,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}
