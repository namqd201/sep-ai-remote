/**
 * Tiện ích thời gian và định dạng múi giờ Việt Nam (UTC+7 / GMT+7)
 */
export declare const VIETNAM_TIMEZONE = "Asia/Ho_Chi_Minh";
/**
 * Lấy thời gian hiện tại theo định dạng ISO với múi giờ +07:00 của Việt Nam
 * Ví dụ: 2026-10-14T02:50:00.000+07:00
 */
export declare function getVietnamNowIso(date?: Date): string;
/**
 * Định dạng thời gian theo chuẩn giờ Việt Nam: HH:mm:ss DD/MM/YYYY
 */
export declare function formatVietnamTime(dateOrIso?: Date | string | null): string;
/**
 * Định dạng rút gọn: HH:mm DD/MM
 */
export declare function formatVietnamTimeShort(dateOrIso?: Date | string | null): string;
/**
 * Tạo câu thoại thông báo hoàn thành task bằng giọng nói AI tiếng Việt
 */
export declare function getTaskCompletionVoiceText(taskTitle?: string): string;
/**
 * Tạo câu thoại thông báo task thất bại / gặp lỗi bằng giọng nói AI tiếng Việt
 */
export declare function getTaskFailureVoiceText(taskTitle?: string, errorReason?: string): string;
/**
 * Tạo câu thoại thông báo task cần phê duyệt trên máy tính
 */
export declare function getTaskApprovalVoiceText(taskTitle?: string): string;
//# sourceMappingURL=date.d.ts.map