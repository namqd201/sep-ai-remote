"use strict";
/**
 * Tiện ích thời gian và định dạng múi giờ Việt Nam (UTC+7 / GMT+7)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VIETNAM_TIMEZONE = void 0;
exports.getVietnamNowIso = getVietnamNowIso;
exports.formatVietnamTime = formatVietnamTime;
exports.formatVietnamTimeShort = formatVietnamTimeShort;
exports.getTaskCompletionVoiceText = getTaskCompletionVoiceText;
exports.getTaskFailureVoiceText = getTaskFailureVoiceText;
exports.getTaskApprovalVoiceText = getTaskApprovalVoiceText;
exports.VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';
/**
 * Lấy thời gian hiện tại theo định dạng ISO với múi giờ +07:00 của Việt Nam
 * Ví dụ: 2026-10-14T02:50:00.000+07:00
 */
function getVietnamNowIso(date = new Date()) {
    const tzOffsetMs = 7 * 60 * 60 * 1000;
    const vnTime = new Date(date.getTime() + tzOffsetMs);
    return vnTime.toISOString().replace('Z', '+07:00');
}
/**
 * Định dạng thời gian theo chuẩn giờ Việt Nam: HH:mm:ss DD/MM/YYYY
 */
function formatVietnamTime(dateOrIso) {
    if (!dateOrIso)
        return '';
    const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
    if (isNaN(d.getTime()))
        return String(dateOrIso);
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: exports.VIETNAM_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const parts = formatter.formatToParts(d);
    const getPart = (type) => parts.find((p) => p.type === type)?.value || '';
    return `${getPart('hour')}:${getPart('minute')}:${getPart('second')} ${getPart('day')}/${getPart('month')}/${getPart('year')}`;
}
/**
 * Định dạng rút gọn: HH:mm DD/MM
 */
function formatVietnamTimeShort(dateOrIso) {
    if (!dateOrIso)
        return '';
    const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
    if (isNaN(d.getTime()))
        return String(dateOrIso);
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: exports.VIETNAM_TIMEZONE,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const parts = formatter.formatToParts(d);
    const getPart = (type) => parts.find((p) => p.type === type)?.value || '';
    return `${getPart('hour')}:${getPart('minute')} ${getPart('day')}/${getPart('month')}`;
}
/**
 * Tạo câu thoại thông báo hoàn thành task bằng giọng nói AI tiếng Việt
 */
function getTaskCompletionVoiceText(taskTitle) {
    const cleanTitle = (taskTitle || 'này').trim();
    return `Sếp Nam ơi, em đã làm xong task '${cleanTitle}' mà sếp giao rồi. Sếp còn việc gì cần em làm nữa không ạ. Sếp vào kiểm tra task kia nhé.`;
}
/**
 * Tạo câu thoại thông báo task thất bại / gặp lỗi bằng giọng nói AI tiếng Việt
 */
function getTaskFailureVoiceText(taskTitle, errorReason) {
    const cleanTitle = (taskTitle || 'này').trim();
    return `Sếp Nam ơi, task '${cleanTitle}' gặp lỗi không thành công rồi ạ. Sếp vào kiểm tra lại giúp em nhé.`;
}
/**
 * Tạo câu thoại thông báo task cần phê duyệt trên máy tính
 */
function getTaskApprovalVoiceText(taskTitle) {
    const cleanTitle = (taskTitle || 'này').trim();
    return `Sếp Nam ơi, task '${cleanTitle}' đang chờ sếp xác nhận trên máy tính ạ.`;
}
//# sourceMappingURL=date.js.map