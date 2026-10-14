import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { EdgeTTS } from '@andresaya/edge-tts';
import { db } from '../db/database.js';
const execFileAsync = promisify(execFile);
async function synthesizeEdgePython(text, voice, rate, pitch) {
    const tempId = crypto.randomUUID();
    const textFilePath = path.join(os.tmpdir(), `tts_input_${tempId}.txt`);
    const outFilePath = path.join(os.tmpdir(), `tts_output_${tempId}.mp3`);
    await fs.writeFile(textFilePath, text, 'utf8');
    const args = [
        '-m',
        'edge_tts',
        '--voice',
        voice,
        '--file',
        textFilePath,
        '--write-media',
        outFilePath
    ];
    if (rate) {
        args.push('--rate', rate);
    }
    if (pitch) {
        args.push('--pitch', pitch);
    }
    try {
        await execFileAsync('python', args, {
            windowsHide: true,
            timeout: 30000
        });
        const buffer = await fs.readFile(outFilePath);
        return buffer;
    }
    finally {
        await fs.unlink(textFilePath).catch(() => { });
        await fs.unlink(outFilePath).catch(() => { });
    }
}
export const AVAILABLE_VOICES = [
    {
        id: 'hoa_my_neural',
        name: 'Hoài My (Nữ Bắc)',
        gender: 'female',
        accent: 'Miền Bắc',
        badge: 'Neural AI',
        description: 'Giọng nữ AI truyền cảm, ngọt ngào, chuẩn phát thanh viên',
        provider: 'edge',
        edgeVoice: 'vi-VN-HoaiMyNeural',
        rate: '+0%',
        pitch: '+0Hz'
    },
    {
        id: 'nam_minh_neural',
        name: 'Nam Minh (Nam Bắc)',
        gender: 'male',
        accent: 'Miền Bắc',
        badge: 'Neural AI',
        description: 'Giọng nam AI trầm ấm, đĩnh đạc, phong thái trợ lý chỉ huy',
        provider: 'edge',
        edgeVoice: 'vi-VN-NamMinhNeural',
        rate: '+0%',
        pitch: '+0Hz'
    },
    {
        id: 'hoa_my_fast',
        name: 'Hoài My Nhanh (Nữ Bắc)',
        gender: 'female',
        accent: 'Miền Bắc',
        badge: 'Nhanh nhẹn',
        description: 'Giọng nữ nói nhanh hơn 15%, thông báo việc dứt khoát tiết kiệm thời gian',
        provider: 'edge',
        edgeVoice: 'vi-VN-HoaiMyNeural',
        rate: '+15%',
        pitch: '+2Hz'
    },
    {
        id: 'hoa_my_gentle',
        name: 'Hoài My Dịu Dàng (Nữ)',
        gender: 'female',
        accent: 'Miền Bắc',
        badge: 'Dịu dàng',
        description: 'Giọng nữ tông ấm, nói chậm rãi, nhẹ nhàng xoa dịu áp lực',
        provider: 'edge',
        edgeVoice: 'vi-VN-HoaiMyNeural',
        rate: '-6%',
        pitch: '-3Hz'
    },
    {
        id: 'nam_minh_deep',
        name: 'Nam Minh Trầm Khàn (Nam)',
        gender: 'male',
        accent: 'Miền Bắc',
        badge: 'Trầm ấm',
        description: 'Giọng nam trầm sâu, dứt khoát, phong thái cận vệ chuyên nghiệp',
        provider: 'edge',
        edgeVoice: 'vi-VN-NamMinhNeural',
        rate: '-4%',
        pitch: '-6Hz'
    },
    {
        id: 'google_female',
        name: 'Chị Google (Truyền thống)',
        gender: 'female',
        accent: 'Toàn quốc',
        badge: 'Google TTS',
        description: 'Giọng đọc Google Translate quen thuộc, rõ từng từ',
        provider: 'google'
    }
];
export class TtsService {
    audioCache = new Map();
    getVoices() {
        return AVAILABLE_VOICES;
    }
    getSelectedVoiceId() {
        return db.getSetting('tts_selected_voice') || 'hoa_my_neural';
    }
    setSelectedVoiceId(voiceId) {
        const exists = AVAILABLE_VOICES.some(v => v.id === voiceId);
        if (!exists)
            return false;
        db.setSetting('tts_selected_voice', voiceId);
        return true;
    }
    async synthesize(text, voiceId) {
        const cleanText = text.trim();
        if (!cleanText) {
            throw new Error('Nội dung văn bản để chuyển thành giọng nói không được rỗng.');
        }
        const targetVoiceId = voiceId || this.getSelectedVoiceId();
        const cacheKey = `${targetVoiceId}:${cleanText}`;
        if (this.audioCache.has(cacheKey)) {
            return this.audioCache.get(cacheKey);
        }
        const voice = AVAILABLE_VOICES.find(v => v.id === targetVoiceId) || AVAILABLE_VOICES[0];
        // 1. Thử phát qua Edge Neural TTS (Python CLI with DRM v2)
        if (voice.provider === 'edge' && voice.edgeVoice) {
            try {
                const buffer = await synthesizeEdgePython(cleanText, voice.edgeVoice, voice.rate, voice.pitch);
                if (buffer && buffer.length > 0) {
                    this.audioCache.set(cacheKey, buffer);
                    return buffer;
                }
            }
            catch (pythonErr) {
                console.warn(`[TtsService] Lỗi tổng hợp giọng Edge qua Python (${voice.name}), thử fallback edge-tts npm:`, pythonErr);
                try {
                    const tts = new EdgeTTS();
                    await tts.synthesize(cleanText, voice.edgeVoice, {
                        rate: voice.rate || '+0%',
                        pitch: voice.pitch || '+0Hz'
                    });
                    const buffer = await tts.toBuffer();
                    if (buffer && buffer.length > 0) {
                        this.audioCache.set(cacheKey, buffer);
                        return buffer;
                    }
                }
                catch (edgeErr) {
                    console.warn(`[TtsService] Lỗi tổng hợp giọng Edge (${voice.name}), fallback sang Google TTS:`, edgeErr);
                }
            }
        }
        // 2. Fallback sang Google Translate TTS
        try {
            const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=vi&client=tw-ob`;
            const res = await fetch(googleUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            if (!res.ok) {
                throw new Error(`Google TTS trả về mã HTTP ${res.status}`);
            }
            const arrayBuf = await res.arrayBuffer();
            const buf = Buffer.from(arrayBuf);
            this.audioCache.set(cacheKey, buf);
            return buf;
        }
        catch (googleErr) {
            console.error('[TtsService] Cả Edge và Google TTS đều gặp lỗi:', googleErr);
            throw googleErr;
        }
    }
}
export const ttsService = new TtsService();
//# sourceMappingURL=ttsService.js.map