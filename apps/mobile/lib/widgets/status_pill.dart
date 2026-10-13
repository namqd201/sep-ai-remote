import 'package:flutter/material.dart';
import '../constants/colors.dart';

class StatusPill extends StatelessWidget {
  final String status;

  const StatusPill({Key? key, required this.status}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    String label;

    switch (status.toUpperCase()) {
      case 'RUNNING':
        bg = AppColors.info.withOpacity(0.2);
        fg = AppColors.info;
        label = 'Đang chạy';
        break;
      case 'COMPLETED':
        bg = AppColors.success.withOpacity(0.2);
        fg = AppColors.success;
        label = 'Hoàn thành';
        break;
      case 'FAILED':
        bg = AppColors.error.withOpacity(0.2);
        fg = AppColors.error;
        label = 'Thất bại';
        break;
      case 'QUEUED_OFFLINE':
        bg = AppColors.warning.withOpacity(0.2);
        fg = AppColors.warning;
        label = 'Hàng đợi Offline';
        break;
      case 'WAITING_APPROVAL':
        bg = Colors.purple.withOpacity(0.2);
        fg = Colors.purpleAccent;
        label = 'Chờ phê duyệt';
        break;
      default:
        bg = AppColors.surfaceLight;
        fg = AppColors.textSecondary;
        label = status;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: fg.withOpacity(0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: 12,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
