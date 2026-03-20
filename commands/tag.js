const isAdmin = require('../lib/isAdmin');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const settings = require('../settings'); // for configurable sticker path

// Helper: get newsletter context (optional, makes messages look forwarded)
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

// Download media from a message and return the temporary file path
async function downloadMediaMessage(message, mediaType) {
    const stream = await downloadContentFromMessage(message, mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    const tmpDir = path.join(__dirname, '../temp/');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `${Date.now()}_${mediaType}`);
    await fs.promises.writeFile(filePath, buffer);
    return filePath;
}

// Clean up temporary file after use
async function cleanup(filePath) {
    if (filePath && fs.existsSync(filePath)) {
        try {
            await fs.promises.unlink(filePath);
        } catch (err) {
            console.warn(`Failed to delete temp file ${filePath}:`, err.message);
        }
    }
}

async function tagCommand(sock, chatId, senderId, messageText, replyMessage, message) {
    try {
        // Check admin status
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, {
                text: '❌ Please make the bot an admin first.',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        if (!isSenderAdmin) {
            // Send a sticker for non‑admins (customizable path)
            const stickerPath = settings.stickerTagPath || './assets/sticktag.webp';
            if (fs.existsSync(stickerPath)) {
                const stickerBuffer = fs.readFileSync(stickerPath);
                await sock.sendMessage(chatId, {
                    sticker: stickerBuffer,
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
            } else {
                // Fallback if sticker not found
                await sock.sendMessage(chatId, {
                    text: '⛔ Only admins can use this command.',
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
            }
            return;
        }

        // Fetch group participants
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;
        const mentionedJidList = participants.map(p => p.id);

        // Determine what to send based on the replied message
        if (replyMessage) {
            const msg = replyMessage;
            let content = { mentions: mentionedJidList };
            let tempFilePath = null;

            try {
                if (msg.imageMessage) {
                    tempFilePath = await downloadMediaMessage(msg.imageMessage, 'image');
                    content.image = { url: tempFilePath };
                    content.caption = messageText || msg.imageMessage.caption || '';
                } else if (msg.videoMessage) {
                    tempFilePath = await downloadMediaMessage(msg.videoMessage, 'video');
                    content.video = { url: tempFilePath };
                    content.caption = messageText || msg.videoMessage.caption || '';
                } else if (msg.documentMessage) {
                    tempFilePath = await downloadMediaMessage(msg.documentMessage, 'document');
                    content.document = { url: tempFilePath };
                    content.fileName = msg.documentMessage.fileName;
                    content.caption = messageText || '';
                } else if (msg.audioMessage) {
                    tempFilePath = await downloadMediaMessage(msg.audioMessage, 'audio');
                    content.audio = { url: tempFilePath };
                    content.ptt = msg.audioMessage.ptt || false; // preserve PTT flag
                } else if (msg.stickerMessage) {
                    // Stickers can be forwarded as is (no download needed)
                    content.sticker = msg.stickerMessage;
                    // Keep the sticker as original (we don't download)
                    // We'll still need to mention users – but stickers can't have mentions.
                    // So we just send the sticker without mentions.
                    await sock.sendMessage(chatId, {
                        sticker: msg.stickerMessage,
                        contextInfo: getNewsletterInfo()
                    }, { quoted: message });
                    return;
                } else if (msg.conversation || msg.extendedTextMessage) {
                    content.text = msg.conversation || msg.extendedTextMessage.text;
                } else {
                    // Unsupported message type
                    await sock.sendMessage(chatId, {
                        text: '⚠️ This message type cannot be tagged.',
                        contextInfo: getNewsletterInfo()
                    }, { quoted: message });
                    return;
                }

                // Send the media/text with mentions
                await sock.sendMessage(chatId, { ...content, contextInfo: getNewsletterInfo() });

                // Clean up temporary file if any
                if (tempFilePath) await cleanup(tempFilePath);
            } catch (downloadErr) {
                console.error('Error downloading/sending media:', downloadErr);
                await sock.sendMessage(chatId, {
                    text: '❌ Failed to process the replied media.',
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                if (tempFilePath) await cleanup(tempFilePath);
            }
        } else {
            // No reply: send a simple text with mentions
            await sock.sendMessage(chatId, {
                text: messageText || 'Tagged message',
                mentions: mentionedJidList,
                contextInfo: getNewsletterInfo()
            });
        }
    } catch (error) {
        console.error('Error in tagCommand:', error);
        await sock.sendMessage(chatId, {
            text: '❌ An error occurred while executing the command.',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }
}

module.exports = tagCommand;