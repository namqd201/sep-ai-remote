/**
 * Đọc hiểu nội dung prompt tiếng Việt, trích xuất chuẩn trọng tâm công việc
 * và sinh câu thoại bắt đầu / hoàn thành tự nhiên, gãy gọn, không bị cắt cụt từ.
 */
export function summarizeTaskPrompt(prompt) {
    let raw = (prompt || '').trim();
    // 1. Loại bỏ các phần chú thích ảnh hoặc file đính kèm
    raw = raw.replace(/📷\s*\[ẢNH ĐÍNH KÈM[\s\S]*$/i, '').trim();
    // 2. Loại bỏ các từ xưng hô, câu chào hoặc mở đầu xã giao
    let text = raw
        .replace(/^(bạn ơi|em ơi|sếp ơi|sếp nam ơi|ơi bạn|ơi em|này bạn|alo|nè|nhờ bạn|nhờ em|giúp tôi|hãy|vui lòng|cho tôi hỏi|cho hỏi|tôi muốn hỏi|tôi muốn|tôi đang muốn|kiểu là|tình huống là|tôi thấy|tôi có những tình huống như:?)[,\s:]*/i, '')
        .trim();
    // 3. Loại bỏ câu đệm ở cuối câu (ví dụ: "giúp tôi nhé", "được không", "coi sao")
    text = text
        .replace(/[,\s]*(giúp tôi nhé|giúp tôi|nhé sếp|nhé bạn|nhé em|nhé|nha|nhá|ạ|đi|xem sao|xem nào|được không|đc ko|được ko|coi sao)[.?!]*$/i, '')
        .trim();
    let shortAction = '';
    let category = 'general';
    // --- QUY TẮC NHẬN DIỆN Ý ĐỊNH ĐẶC THÙ ---
    // Trường hợp: Tối ưu thông báo giọng nói / đọc rút gọn
    if (/thông\s*báo/i.test(text) &&
        /(?:rút\s*gọn|rút\s*ngắn|đọc\s*hiểu|trọng\s*tâm|giọng\s*nói|bắt\s*đầu\s*task|xong\s*task)/i.test(text)) {
        category = 'speech_opt';
        shortAction = 'tối ưu câu thông báo giọng nói thông minh';
    }
    // Trường hợp: Hỏi giải pháp / cách thức ("có cách nào", "làm sao để", "làm thế nào")
    else if (/(?:từ\s+(?:app|ứng dụng)\s+này[,\s]*)?(?:có cách nào|làm sao để|làm thế nào để|cách nào để)\s+/i.test(text)) {
        category = 'solution';
        const qMatch = text.match(/(?:từ\s+(?:app|ứng dụng)\s+này[,\s]*)?(?:có cách nào|làm sao để|làm thế nào để|cách nào để)\s+([^?.]+?)(?:\s+không|\s+ko|\s+được không|\?|$)/i);
        if (qMatch) {
            let topic = qMatch[1].trim().replace(/^(để|được)\s+/i, '');
            if (!/từ xa/i.test(topic) && /đánh thức|bật máy|truy cập/i.test(topic)) {
                topic += ' từ xa';
            }
            shortAction = 'tìm cách ' + topic;
        }
        else {
            shortAction = 'tìm giải pháp theo yêu cầu của Sếp';
        }
    }
    // Trường hợp: Thêm tính năng / tạo mới / ở cài đặt
    else if (/(?:ở\s+cài\s+đặt[,\s:]*)?(?:thêm|tạo|bổ sung|gắn thêm)\s+/i.test(text)) {
        category = 'feature';
        const fMatch = text.match(/(?:ở\s+cài\s+đặt[,\s:]*)?(?:thêm|tạo|bổ sung|gắn thêm)\s+(?:cho tôi\s+)?(?:1\s+)?(?:check\s*box|checkbox|nút|chức năng|tính năng)?[,:\s]*([^.;\n]+?)(?:\.|\n|khi tích|để|$)/i);
        if (fMatch) {
            let target = fMatch[1].trim().replace(/^(cho tôi|cho em)\s+/i, '');
            if (/ở\s+cài\s+đặt/i.test(raw) && !/cài\s+đặt/i.test(target)) {
                shortAction = 'thêm ' + target + ' trong cài đặt';
            }
            else {
                shortAction = 'thêm ' + target;
            }
        }
        else {
            shortAction = 'thêm tính năng mới';
        }
    }
    // Trường hợp: Sửa lỗi / Fix bug
    else if (/^(?:sửa|fix|chỉnh lại|khắc phục|sửa lỗi)\s+/i.test(text)) {
        category = 'fix';
        const fixMatch = text.match(/^(?:sửa|fix|chỉnh lại|khắc phục|sửa lỗi)\s+(?:cho tôi\s+)?([^.;\n]+?)(?:\.|\n|để|$)/i);
        const target = fixMatch ? fixMatch[1].trim() : text;
        shortAction = 'sửa ' + target;
    }
    // Trường hợp: Kiểm tra / Test
    else if (/^(?:kiểm tra|test|check|xem lại)\s+/i.test(text)) {
        category = 'check';
        const checkMatch = text.match(/^(?:kiểm tra|test|check|xem lại)\s+(?:lại\s+)?(?:cho tôi\s+)?([^.;\n]+?)(?:\.|\n|xem sao|để|$)/i);
        const target = checkMatch ? checkMatch[1].trim() : text;
        shortAction = 'kiểm tra ' + target;
    }
    // Trường hợp: Yêu cầu trực tiếp dạng chỉ đạo "giờ cho nó...", "làm luôn đi"
    else if (/^(?:làm luôn|triển khai luôn|làm đi|triển khai ngay)\b/i.test(text)) {
        category = 'general';
        shortAction = 'triển khai công việc ngay';
    }
    else if (/^(?:test lại xem|chạy thử lại)\b/i.test(text)) {
        category = 'check';
        shortAction = 'kiểm tra và chạy thử lại';
    }
    else {
        // Trích xuất thông minh theo câu đầu tiên, cắt đúng ranh giới từ (không bao giờ cắt đôi từ)
        const firstSentence = text.split(/[\n.?!]/)[0].trim().replace(/^(tôi muốn|hãy|làm|bạn)\s+/i, '');
        const words = firstSentence.split(/\s+/).filter(Boolean);
        if (words.length > 7) {
            shortAction = words.slice(0, 7).join(' ');
        }
        else {
            shortAction = firstSentence;
        }
    }
    // Dọn dẹp ký tự thừa, dấu ba chấm
    shortAction = shortAction
        .replace(/[.…]*$/, '')
        .replace(/^[:\s-]+/, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!shortAction) {
        shortAction = 'công việc của Sếp';
    }
    // Tạo tiêu đề viết hoa chữ cái đầu
    const shortTitle = shortAction.charAt(0).toUpperCase() + shortAction.slice(1);
    // Sinh câu thoại bắt đầu
    let startVoiceText = '';
    if (category === 'speech_opt') {
        startVoiceText = 'Dạ em bắt đầu tối ưu câu thông báo giọng nói thông minh cho Sếp rồi ạ.';
    }
    else if (category === 'solution') {
        startVoiceText = `Dạ em bắt đầu ${shortAction} cho Sếp rồi ạ.`;
    }
    else if (category === 'check' || category === 'fix' || category === 'feature') {
        startVoiceText = `Dạ em bắt đầu ${shortAction} cho Sếp rồi ạ.`;
    }
    else {
        startVoiceText = `Dạ em bắt đầu xử lý việc: ${shortAction} cho Sếp rồi ạ.`;
    }
    // Sinh câu thoại hoàn thành
    let doneVoiceText = '';
    if (category === 'speech_opt') {
        doneVoiceText = 'Sếp Nam ơi, em đã tối ưu xong câu đọc thông báo trọng tâm cho Sếp rồi ạ. Sếp vào kiểm tra nhé!';
    }
    else if (category === 'solution') {
        const cleanTopic = shortAction.replace(/^tìm (?:cách|giải pháp)\s+/i, '');
        doneVoiceText = `Sếp Nam ơi, em đã tìm xong giải pháp ${cleanTopic} rồi ạ. Sếp vào xem nhé!`;
    }
    else if (category === 'check') {
        doneVoiceText = `Sếp Nam ơi, em đã ${shortAction} xong rồi ạ. Sếp vào xem kết quả nhé!`;
    }
    else if (category === 'fix') {
        doneVoiceText = `Sếp Nam ơi, em đã ${shortAction} xong rồi ạ. Sếp vào kiểm tra nhé!`;
    }
    else if (category === 'feature') {
        doneVoiceText = `Sếp Nam ơi, em đã hoàn thành việc ${shortAction} rồi ạ. Sếp vào kiểm tra nhé!`;
    }
    else {
        doneVoiceText = `Sếp Nam ơi, em đã hoàn thành xong việc: ${shortAction} rồi ạ. Sếp vào kiểm tra nhé!`;
    }
    return {
        shortTitle,
        shortAction,
        startVoiceText,
        doneVoiceText
    };
}
//# sourceMappingURL=taskSummarizer.js.map