const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { writeFile, unlink } = require('fs/promises');
const isOwnerOrSudo = require('../lib/isOwner');
const settings = require('../settings');  // to get owner numbers

// Constants
const DATA_DIR = path.join(__dirname, '../data');
const CONFIG_PATH = path.join(DATA_DIR, 'antidelete.json');
const TEMP_MEDIA_DIR = path.join(__dirname, '../tmp');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(TEMP_MEDIA_DIR)) fs.mkdirSync(TEMP_MEDIA_DIR, { recursive: true });

// Helper: newsletter context for all messages
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

// Helper: get all owner JIDs (including the bot itself)
function getOwnerJids() {
    const owners = Array.isArray(settings.ownerNumber) ? settings.ownerNumber : [settings.ownerNumber];
    return owners.map(owner => owner.includes('@') ? owner : `${owner}@s.whatsapp.net`);
}

// Temporary storage for messages (simple Map)
const messageStore = new Map();

// ----- Config persistence -----
function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return { enabled: false };
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch {
        return { enabled: false };
    }
}

function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (err) {
        console.error('❌ Config save error:', err);
    }
}

// ----- Temp folder cleanup (max 200 MB) -----
function getFolderSizeMB(folder) {
    try {
        const files = fs.readdirSync(folder);
        let total = 0;
        for (const file of files) {
            const filePath = path.join(folder, file);
            if (fs.statSync(filePath).isFile()) {
                total += fs.statSync(filePath).size;
            }
        }
        return total / (1024 * 1024);
    } catch {
        return 0;
    }
}

function cleanTempFolder() {
    try {
        const sizeMB = getFolderSizeMB(TEMP_MEDIA_DIR);
        if (sizeMB > 200) {
            const files = fs.readdirSync(TEMP_MEDIA_DIR);
            for (const file of files) {
                fs.unlinkSync(path.join(TEMP_MEDIA_DIR, file));
            }
            console.log(`🧹 Temp folder cleaned (size was ${sizeMB.toFixed(2)} MB)`);
        }
    } catch (err) {
        console.error('Temp cleanup error:', err);
    }
}
// Run every 5 minutes
setInterval(cleanTempFolder, 5 * 60 * 1000);

// ----- Command handler -----
async function handleAntideleteCommand(sock, chatId, message, match) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        if (!message.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, {
                text: '❌ Only the bot owner can use this command.',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        const config = loadConfig();

        if (!match) {
            const status = config.enabled ? '✅ Enabled' : '❌ Disabled';
            const helpText = `*ANTIDELETE*\n\nCurrent Status: ${status}\n\n*.antidelete on* - Enable\n*.antidelete off* - Disable`;
            await sock.sendMessage(chatId, {
                text: helpText,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        if (match === 'on') {
            config.enabled = true;
            saveConfig(config);
            await sock.sendMessage(chatId, {
                text: '✅ *Antidelete enabled*',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        } else if (match === 'off') {
            config.enabled = false;
            saveConfig(config);
            await sock.sendMessage(chatId, {
                text: '❌ *Antidelete disabled*',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                text: '⚠️ Invalid argument. Use `.antidelete` to see usage.',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        }
    } catch (err) {
        console.error('Antidelete command error:', err);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to process antidelete command.',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }
}

// ----- Store incoming messages (and forward view‑once) -----
async function storeMessage(sock, message) {
    try {
        const config = loadConfig();
        if (!config.enabled) return;

        if (!message.key?.id) return;
        const messageId = message.key.id;

        // Avoid duplicates
        if (messageStore.has(messageId)) return;

        let content = '';
        let mediaType = '';
        let mediaPath = '';
        let isViewOnce = false;

        const sender = message.key.participant || message.key.remoteJid;
        const isGroup = message.key.remoteJid.endsWith('@g.us');

        // Extract content, handling view‑once wrappers
        const viewOnceContainer = message.message?.viewOnceMessageV2?.message || message.message?.viewOnceMessage?.message;
        if (viewOnceContainer) {
            isViewOnce = true;
            if (viewOnceContainer.imageMessage) {
                mediaType = 'image';
                content = viewOnceContainer.imageMessage.caption || '';
                const stream = await downloadContentFromMessage(viewOnceContainer.imageMessage, 'image');
                const buffer = await streamToBuffer(stream);
                mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.jpg`);
                await writeFile(mediaPath, buffer);
            } else if (viewOnceContainer.videoMessage) {
                mediaType = 'video';
                content = viewOnceContainer.videoMessage.caption || '';
                const stream = await downloadContentFromMessage(viewOnceContainer.videoMessage, 'video');
                const buffer = await streamToBuffer(stream);
                mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.mp4`);
                await writeFile(mediaPath, buffer);
            }
        } else if (message.message?.conversation) {
            content = message.message.conversation;
        } else if (message.message?.extendedTextMessage?.text) {
            content = message.message.extendedTextMessage.text;
        } else if (message.message?.imageMessage) {
            mediaType = 'image';
            content = message.message.imageMessage.caption || '';
            const stream = await downloadContentFromMessage(message.message.imageMessage, 'image');
            const buffer = await streamToBuffer(stream);
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.jpg`);
            await writeFile(mediaPath, buffer);
        } else if (message.message?.stickerMessage) {
            mediaType = 'sticker';
            const stream = await downloadContentFromMessage(message.message.stickerMessage, 'sticker');
            const buffer = await streamToBuffer(stream);
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.webp`);
            await writeFile(mediaPath, buffer);
        } else if (message.message?.videoMessage) {
            mediaType = 'video';
            content = message.message.videoMessage.caption || '';
            const stream = await downloadContentFromMessage(message.message.videoMessage, 'video');
            const buffer = await streamToBuffer(stream);
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.mp4`);
            await writeFile(mediaPath, buffer);
        } else if (message.message?.audioMessage) {
            mediaType = 'audio';
            const mime = message.message.audioMessage.mimetype || '';
            const ext = mime.includes('mpeg') ? 'mp3' : (mime.includes('ogg') ? 'ogg' : 'mp3');
            const stream = await downloadContentFromMessage(message.message.audioMessage, 'audio');
            const buffer = await streamToBuffer(stream);
            mediaPath = path.join(TEMP_MEDIA_DIR, `${messageId}.${ext}`);
            await writeFile(mediaPath, buffer);
        }

        // Store for later use on deletion
        messageStore.set(messageId, {
            content,
            mediaType,
            mediaPath,
            sender,
            group: isGroup ? message.key.remoteJid : null,
            timestamp: new Date().toISOString()
        });

        // Anti‑ViewOnce: forward immediately to all owners
        if (isViewOnce && mediaType && fs.existsSync(mediaPath)) {
            const owners = getOwnerJids();
            const senderName = sender.split('@')[0];
            const caption = `*Anti‑ViewOnce ${mediaType}*\nFrom: @${senderName}`;
            for (const owner of owners) {
                try {
                    if (mediaType === 'image') {
                        await sock.sendMessage(owner, {
                            image: { url: mediaPath },
                            caption,
                            mentions: [sender],
                            contextInfo: getNewsletterInfo()
                        });
                    } else if (mediaType === 'video') {
                        await sock.sendMessage(owner, {
                            video: { url: mediaPath },
                            caption,
                            mentions: [sender],
                            contextInfo: getNewsletterInfo()
                        });
                    }
                } catch (e) {
                    console.error(`Failed to forward view‑once to ${owner}:`, e);
                }
            }
            // Clean up immediately (the original will be stored but we don't need the file anymore)
            await unlink(mediaPath).catch(() => {});
        }
    } catch (err) {
        console.error('storeMessage error:', err);
    }
}

// Helper: convert download stream to buffer
async function streamToBuffer(stream) {
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

// ----- Handle message deletion (revocation) -----
async function handleMessageRevocation(sock, revocationMessage) {
    try {
        const config = loadConfig();
        if (!config.enabled) return;

        const messageId = revocationMessage.message?.protocolMessage?.key?.id;
        if (!messageId) return;

        const deletedBy = revocationMessage.participant || revocationMessage.key.participant || revocationMessage.key.remoteJid;
        const owners = getOwnerJids();

        // Ignore if the deletion is done by the bot itself or any owner
        if (owners.includes(deletedBy) || deletedBy === sock.user.id) return;

        const original = messageStore.get(messageId);
        if (!original) return;

        const sender = original.sender;
        const senderName = sender.split('@')[0];
        const groupName = original.group ? (await sock.groupMetadata(original.group)).subject : '';

        const time = new Date().toLocaleString('en-US', {
            timeZone: settings.timeZone || 'Asia/Kolkata',
            hour12: true,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        let text = `*🔰 ANTIDELETE REPORT 🔰*\n\n` +
            `*🗑️ Deleted By:* @${deletedBy.split('@')[0]}\n` +
            `*👤 Sender:* @${senderName}\n` +
            `*📱 Number:* ${sender}\n` +
            `*🕒 Time:* ${time}\n`;
        if (groupName) text += `*👥 Group:* ${groupName}\n`;
        if (original.content) text += `\n*💬 Deleted Message:*\n${original.content}`;

        // Send report to all owners
        for (const owner of owners) {
            try {
                await sock.sendMessage(owner, {
                    text,
                    mentions: [deletedBy, sender],
                    contextInfo: getNewsletterInfo()
                });
            } catch (e) {
                console.error(`Failed to send antidelete report to ${owner}:`, e);
            }
        }

        // Send media if present
        if (original.mediaType && fs.existsSync(original.mediaPath)) {
            const mediaCaption = `*Deleted ${original.mediaType}*\nFrom: @${senderName}`;
            for (const owner of owners) {
                try {
                    switch (original.mediaType) {
                        case 'image':
                            await sock.sendMessage(owner, {
                                image: { url: original.mediaPath },
                                caption: mediaCaption,
                                mentions: [sender],
                                contextInfo: getNewsletterInfo()
                            });
                            break;
                        case 'sticker':
                            await sock.sendMessage(owner, {
                                sticker: { url: original.mediaPath },
                                contextInfo: getNewsletterInfo()
                            });
                            break;
                        case 'video':
                            await sock.sendMessage(owner, {
                                video: { url: original.mediaPath },
                                caption: mediaCaption,
                                mentions: [sender],
                                contextInfo: getNewsletterInfo()
                            });
                            break;
                        case 'audio':
                            await sock.sendMessage(owner, {
                                audio: { url: original.mediaPath },
                                mimetype: 'audio/mpeg',
                                ptt: false,
                                contextInfo: getNewsletterInfo()
                            });
                            break;
                    }
                } catch (e) {
                    console.error(`Failed to send deleted media to ${owner}:`, e);
                }
            }
            // Cleanup after sending
            await unlink(original.mediaPath).catch(() => {});
        }

        messageStore.delete(messageId);
    } catch (err) {
        console.error('handleMessageRevocation error:', err);
    }
}

module.exports = {
    handleAntideleteCommand,
    handleMessageRevocation,
    storeMessage
};