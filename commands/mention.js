const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// Helper: newsletter context
function getNewsletterInfo() {
    return {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363406449026172@newsletter',
            newsletterName: 'DEX SHYAM TECH',
            serverMessageId: -1
        }
    };
}

// Paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_PATH = path.join(DATA_DIR, 'mention.json');
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

// Default state: disabled, text reply "Hi"
const DEFAULT_STATE = { enabled: false, assetPath: '', type: 'text', textContent: 'Hi' };

function loadState() {
    try {
        const raw = fs.readFileSync(STATE_PATH, 'utf8');
        const state = JSON.parse(raw);
        // If assetPath points to default sticker but doesn't exist, fallback to text
        if (state.assetPath && state.assetPath.includes('mention_default.webp') && !fs.existsSync(path.join(__dirname, '..', state.assetPath))) {
            return { ...DEFAULT_STATE, enabled: state.enabled };
        }
        return state;
    } catch {
        return { ...DEFAULT_STATE };
    }
}

function saveState(state) {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

// Reset to default: text "Hi"
function resetToDefault() {
    saveState({ ...DEFAULT_STATE });
}

// Handle mention detection
async function handleMentionDetection(sock, chatId, message) {
    try {
        if (message.key?.fromMe) return;

        const state = loadState();
        if (!state.enabled) return;

        // Normalize bot JID (handles formats like '12345:abcd@...')
        const rawId = sock.user?.id || sock.user?.jid || '';
        if (!rawId) return;
        const botNum = rawId.split('@')[0].split(':')[0];
        const botJids = [
            `${botNum}@s.whatsapp.net`,
            `${botNum}@whatsapp.net`,
            rawId
        ];

        // Extract mentioned JIDs from various message types
        const msg = message.message || {};
        const contexts = [
            msg.extendedTextMessage?.contextInfo,
            msg.imageMessage?.contextInfo,
            msg.videoMessage?.contextInfo,
            msg.documentMessage?.contextInfo,
            msg.stickerMessage?.contextInfo,
            msg.buttonsResponseMessage?.contextInfo,
            msg.listResponseMessage?.contextInfo
        ].filter(Boolean);

        let mentioned = [];
        for (const c of contexts) {
            if (Array.isArray(c.mentionedJid)) mentioned.push(...c.mentionedJid);
        }

        // Also check direct mentionedJid arrays
        const directMentionLists = [msg.extendedTextMessage?.mentionedJid, msg.mentionedJid].filter(Array.isArray);
        for (const arr of directMentionLists) mentioned.push(...arr);

        // Heuristic fallback: check if text contains bot number as a mention-like token
        const rawText = (
            msg.conversation ||
            msg.extendedTextMessage?.text ||
            msg.imageMessage?.caption ||
            msg.videoMessage?.caption ||
            ''
        ).toString();
        let isBotMentioned = mentioned.some(j => botJids.includes(j));
        if (!isBotMentioned && rawText) {
            const safeBot = botNum.replace(/[-\s]/g, '');
            const re = new RegExp(`@?${safeBot}\\b`);
            isBotMentioned = re.test(rawText.replace(/\s+/g, ''));
        }
        if (!isBotMentioned) return;

        // Send appropriate reply
        if (!state.assetPath) {
            // Text reply (either custom text or default "Hi")
            const replyText = state.textContent || 'Hi';
            await sock.sendMessage(chatId, { text: replyText, contextInfo: getNewsletterInfo() }, { quoted: message });
            return;
        }

        const assetPath = path.join(__dirname, '..', state.assetPath);
        if (!fs.existsSync(assetPath)) {
            // Fallback to text if asset missing
            await sock.sendMessage(chatId, { text: 'Hi', contextInfo: getNewsletterInfo() }, { quoted: message });
            return;
        }

        try {
            const payload = { contextInfo: getNewsletterInfo() };
            if (state.type === 'sticker') {
                payload.sticker = fs.readFileSync(assetPath);
            } else if (state.type === 'image') {
                payload.image = fs.readFileSync(assetPath);
                if (state.caption) payload.caption = state.caption;
            } else if (state.type === 'video') {
                payload.video = fs.readFileSync(assetPath);
                if (state.caption) payload.caption = state.caption;
                if (state.gifPlayback) payload.gifPlayback = true;
            } else if (state.type === 'audio') {
                payload.audio = fs.readFileSync(assetPath);
                payload.mimetype = state.mimetype || 'audio/mpeg';
                payload.ptt = state.ptt || false;
            } else if (state.type === 'text') {
                payload.text = fs.readFileSync(assetPath, 'utf8');
            } else {
                payload.text = 'Hi';
            }
            await sock.sendMessage(chatId, payload, { quoted: message });
        } catch (e) {
            console.error('Send failed:', e);
            await sock.sendMessage(chatId, { text: 'Hi', contextInfo: getNewsletterInfo() }, { quoted: message });
        }
    } catch (err) {
        console.error('handleMentionDetection error:', err);
    }
}

// Command: .mention on|off|status|reset
async function mentionToggleCommand(sock, chatId, message, args, isOwner) {
    if (!isOwner) {
        return sock.sendMessage(chatId, {
            text: '🔒 Sirf bot owner hi ye command use kar sakta hai!',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }

    const action = (args[0] || '').toLowerCase();
    const state = loadState();

    switch (action) {
        case 'on':
            state.enabled = true;
            saveState(state);
            await sock.sendMessage(chatId, {
                text: '✅ Mention reply enabled!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            break;

        case 'off':
            state.enabled = false;
            saveState(state);
            await sock.sendMessage(chatId, {
                text: '❌ Mention reply disabled!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            break;

        case 'status':
            let statusMsg = `📊 *Mention Reply Status*\n\nEnabled: ${state.enabled ? '✅ Yes' : '❌ No'}\n`;
            if (state.assetPath) {
                statusMsg += `Type: ${state.type}\nPath: ${state.assetPath}\n`;
            } else {
                statusMsg += `Reply: ${state.textContent || 'Hi'}\n`;
            }
            await sock.sendMessage(chatId, {
                text: statusMsg,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            break;

        case 'reset':
            resetToDefault();
            await sock.sendMessage(chatId, {
                text: '🔄 Mention reply reset to default (text: Hi)',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            break;

        default:
            await sock.sendMessage(chatId, {
                text: `*Mention Commands*\n.mention on\n.mention off\n.mention status\n.mention reset\n.mention set (reply to media/text)`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
    }
}

// Command: .mention set (reply to media or text)
async function setMentionCommand(sock, chatId, message, isOwner) {
    if (!isOwner) {
        return sock.sendMessage(chatId, {
            text: '🔒 Sirf bot owner hi ye command use kar sakta hai!',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }

    const ctx = message.message?.extendedTextMessage?.contextInfo;
    const qMsg = ctx?.quotedMessage;
    if (!qMsg) {
        return sock.sendMessage(chatId, {
            text: '⚠️ Kisi media ya text pe reply karo .mention set likhkar!',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }

    // Determine type and media
    let type = null;
    let dataType = null;
    let media = null;
    let textContent = null;

    if (qMsg.stickerMessage) { type = 'sticker'; dataType = 'stickerMessage'; media = qMsg.stickerMessage; }
    else if (qMsg.imageMessage) { type = 'image'; dataType = 'imageMessage'; media = qMsg.imageMessage; }
    else if (qMsg.videoMessage) { type = 'video'; dataType = 'videoMessage'; media = qMsg.videoMessage; }
    else if (qMsg.audioMessage) { type = 'audio'; dataType = 'audioMessage'; media = qMsg.audioMessage; }
    else if (qMsg.documentMessage) { type = 'document'; dataType = 'documentMessage'; media = qMsg.documentMessage; }
    else if (qMsg.conversation) { type = 'text'; textContent = qMsg.conversation; }
    else if (qMsg.extendedTextMessage?.text) { type = 'text'; textContent = qMsg.extendedTextMessage.text; }
    else {
        return sock.sendMessage(chatId, {
            text: '❌ Unsupported type. Reply to sticker, image, video, audio, or text.',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }

    // Handle text separately
    if (type === 'text') {
        if (!textContent || textContent.trim().length === 0) {
            return sock.sendMessage(chatId, {
                text: '⚠️ Text khali hai!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        }
        const state = loadState();
        state.assetPath = ''; // no asset, text mode
        state.type = 'text';
        state.textContent = textContent;
        state.enabled = state.enabled; // keep existing enabled state
        saveState(state);
        return sock.sendMessage(chatId, {
            text: '✅ Text reply set!',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }

    // Download media
    let buffer;
    try {
        const kind = type === 'sticker' ? 'sticker' : type;
        const stream = await downloadContentFromMessage(media, kind);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        buffer = Buffer.concat(chunks);
    } catch (err) {
        console.error('Download error:', err);
        return sock.sendMessage(chatId, {
            text: '❌ Media download fail ho gaya!',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }

    // Size limit 1MB
    if (buffer.length > 1024 * 1024) {
        return sock.sendMessage(chatId, {
            text: '❌ File size 1MB se zyada hai!',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }

    // Determine extension and additional flags
    let ext = 'bin';
    let mimetype = media.mimetype || '';
    let ptt = false;
    let gifPlayback = false;
    let caption = media.caption || '';

    if (type === 'sticker') ext = 'webp';
    else if (type === 'image') ext = mimetype.includes('png') ? 'png' : 'jpg';
    else if (type === 'video') {
        ext = 'mp4';
        gifPlayback = !!media.gifPlayback;
    }
    else if (type === 'audio') {
        if (mimetype.includes('ogg') || mimetype.includes('opus')) { ext = 'ogg'; mimetype = 'audio/ogg; codecs=opus'; }
        else if (mimetype.includes('mpeg') || mimetype.includes('mp3')) { ext = 'mp3'; mimetype = 'audio/mpeg'; }
        else if (mimetype.includes('aac')) { ext = 'aac'; mimetype = 'audio/aac'; }
        else if (mimetype.includes('wav')) { ext = 'wav'; mimetype = 'audio/wav'; }
        else if (mimetype.includes('m4a') || mimetype.includes('mp4')) { ext = 'm4a'; mimetype = 'audio/mp4'; }
        else { ext = 'mp3'; mimetype = 'audio/mpeg'; }
        ptt = !!media.ptt;
    }
    else if (type === 'document') ext = 'bin';

    // Clean up old custom assets
    const files = fs.readdirSync(ASSETS_DIR);
    for (const f of files) {
        if (f.startsWith('mention_custom.')) {
            try { fs.unlinkSync(path.join(ASSETS_DIR, f)); } catch {}
        }
    }

    // Save new asset
    const outName = `mention_custom.${ext}`;
    const outPath = path.join(ASSETS_DIR, outName);
    fs.writeFileSync(outPath, buffer);

    // Update state
    const state = loadState();
    state.assetPath = path.join('assets', outName);
    state.type = type;
    if (type === 'audio') { state.mimetype = mimetype; state.ptt = ptt; }
    if (type === 'video') state.gifPlayback = gifPlayback;
    if (caption) state.caption = caption;
    // Keep textContent for fallback
    saveState(state);

    await sock.sendMessage(chatId, {
        text: `✅ ${type} set as mention reply!`,
        contextInfo: getNewsletterInfo()
    }, { quoted: message });
}

module.exports = {
    handleMentionDetection,
    mentionToggleCommand,
    setMentionCommand
};