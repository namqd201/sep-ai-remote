import { Router } from 'express';
import { authService } from '../services/authService.js';
import { taskService } from '../services/taskService.js';
import { TaskStatus } from '@sep-ai/shared';
const router = Router();
// Middleware cho phép gọi nội bộ từ localhost (cho Antigravity agent) hoặc qua xác thực JWT
const allowLocalOrAuth = (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || '';
    if (ip === '127.0.0.1' || ip === '::1' || ip.includes('127.0.0.1')) {
        return next();
    }
    return authService.authenticateMiddleware(req, res, next);
};
// 1. Lấy danh sách task (có lọc theo status)
router.get('/', allowLocalOrAuth, (req, res) => {
    const status = req.query.status;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const tasks = taskService.listTasks(status, limit);
    res.json({ success: true, tasks });
});
// 2. Lấy danh sách hàng đợi chờ làm (Task Queue / Pending)
router.get('/queue', allowLocalOrAuth, (req, res) => {
    const tasks = taskService.getWaitingQueueTasks();
    res.json({ success: true, count: tasks.length, tasks });
});
// 3. Kích hoạt lấy và chạy task tiếp theo trong hàng đợi (Next Task)
router.post('/queue/next', allowLocalOrAuth, (req, res) => {
    const result = taskService.executeNextInQueue();
    if (!result.success) {
        res.status(400).json(result);
        return;
    }
    res.json(result);
});
// 4. Kích hoạt chạy một task cụ thể từ hàng đợi
router.post('/:id/execute', allowLocalOrAuth, (req, res) => {
    const result = taskService.executeQueuedTask(req.params.id);
    if (!result.success) {
        res.status(400).json(result);
        return;
    }
    res.json(result);
});
// 5. Xóa / Hủy một task khỏi hàng đợi
router.delete('/:id', allowLocalOrAuth, (req, res) => {
    const ok = taskService.deleteQueuedTask(req.params.id);
    if (!ok) {
        res.status(404).json({ error: 'Không tìm thấy task để xóa' });
        return;
    }
    res.json({ success: true, message: 'Đã xóa task khỏi danh sách chờ' });
});
// 5.1. Thử lại / Chạy lại một task (Retry / Re-queue)
router.post('/:id/retry', allowLocalOrAuth, (req, res) => {
    const result = taskService.retryTask(req.params.id);
    if (!result.success) {
        res.status(400).json(result);
        return;
    }
    res.json(result);
});
// 5.2. Dọn dẹp tất cả task bị lỗi (Clean Failed Tasks)
router.post('/clean-failed', allowLocalOrAuth, (req, res) => {
    const result = taskService.cleanFailedTasks();
    res.json(result);
});
// 6. Tạo task mới (Hỗ trợ cờ isQueued để thêm vào danh sách chờ)
router.post('/', allowLocalOrAuth, (req, res) => {
    const body = req.body;
    if (!body.prompt || body.prompt.trim() === '') {
        res.status(400).json({ error: 'Nội dung prompt không được để trống' });
        return;
    }
    const deviceId = req.user?.deviceId || 'antigravity_pc';
    const { task, isDuplicate } = taskService.createTask(body, deviceId);
    res.status(isDuplicate ? 200 : 201).json({
        success: true,
        task,
        isDuplicate,
        message: isDuplicate
            ? 'Task đã tồn tại (Chống gửi trùng lặp qua Idempotency Key)'
            : task.status === TaskStatus.PENDING
                ? 'Task đã được lưu vào Danh sách chờ. Sếp có thể bấm kích hoạt hoặc bảo Antigravity tự vào lấy làm.'
                : task.status === TaskStatus.QUEUED_OFFLINE
                    ? 'PC đang offline. Task đã được lưu vào hàng đợi để chạy khi PC kết nối lại.'
                    : 'Task đã được chuyển tới agent Antigravity thành công.'
    });
});
// 7. Lấy chi tiết một task
router.get('/:id', allowLocalOrAuth, (req, res) => {
    const task = taskService.getTask(req.params.id);
    if (!task) {
        res.status(404).json({ error: 'Không tìm thấy task' });
        return;
    }
    res.json({ success: true, task });
});
// 8. Phản hồi xác nhận hoặc từ chối đề xuất của Antigravity (Confirm / Reject Proposal)
router.post('/:id/respond', allowLocalOrAuth, async (req, res) => {
    const { action, feedbackText } = req.body;
    if (!action || (action !== 'confirm' && action !== 'reject')) {
        res.status(400).json({ error: 'Hành động phản hồi phải là confirm hoặc reject' });
        return;
    }
    const result = await taskService.respondToProposal(req.params.id, action, feedbackText);
    if (!result.success) {
        res.status(400).json(result);
        return;
    }
    res.json(result);
});
// 9. Gửi chỉ đạo làm tiếp cho task (Reply / Follow-up Directive)
router.post('/:id/reply', allowLocalOrAuth, async (req, res) => {
    const { prompt, attachments } = req.body;
    if (!prompt || !prompt.trim()) {
        res.status(400).json({ error: 'Nội dung chỉ đạo không được để trống' });
        return;
    }
    const result = await taskService.replyToTask(req.params.id, prompt, attachments);
    if (!result.success) {
        res.status(400).json(result);
        return;
    }
    res.json(result);
});
export default router;
//# sourceMappingURL=taskRoutes.js.map