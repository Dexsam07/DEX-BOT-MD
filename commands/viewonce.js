const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// Helper for newsletter context
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

// Helper: download media to a temporary buffer
async function downloadMedia(message, type) {
    const stream = await downloadContentFromMessage(message, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

async function viewonceCommand(sock, chatId, message) {
    try {
        // Get quoted message
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            await sock.sendMessage(chatId, {
                text: '⚠️ Kisi view‑once message pe reply karo!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Check both old and new view‑once structures
        let mediaMessage = null;
        let mediaType = null;

        // New structure: viewOnceMessageV2
        if (quoted.viewOnceMessageV2?.message) {
            const inner = quoted.viewOnceMessageV2.message;
            if (inner.imageMessage) {
                mediaMessage = inner.imageMessage;
                mediaType = 'image';
            } else if (inner.videoMessage) {
                mediaMessage = inner.videoMessage;
                mediaType = 'video';
            }
        }
        // Old structure: viewOnceMessage
        else if (quoted.viewOnceMessage?.message) {
            const inner = quoted.viewOnceMessage.message;
            if (inner.imageMessage) {
                mediaMessage = inner.imageMessage;
                mediaType = 'image';
            } else if (inner.videoMessage) {
                mediaMessage = inner.videoMessage;
                mediaType = 'video';
            }
        }
        // Direct image/video messages with viewOnce flag (sometimes used)
        else if (quoted.imageMessage?.viewOnce) {
            mediaMessage = quoted.imageMessage;
            mediaType = 'image';
        } else if (quoted.videoMessage?.viewOnce) {
            mediaMessage = quoted.videoMessage;
            mediaType = 'video';
        }

        if (!mediaMessage || !mediaType) {
            await sock.sendMessage(chatId, {
                text: '❌ Ye view‑once message nahi lag raha! Sirf image/video view‑once pe reply karo.',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Download media
        const buffer = await downloadMedia(mediaMessage, mediaType);

        // Prepare options
        const caption = mediaMessage.caption || '';
        const options = {
            caption,
            contextInfo: getNewsletterInfo()
        };

        // Send based on type
        if (mediaType === 'image') {
            await sock.sendMessage(chatId, {
                image: buffer,
                ...options
            }, { quoted: message });
        } else if (mediaType === 'video') {
            await sock.sendMessage(chatId, {
                video: buffer,
                ...options
            }, { quoted: message });
        }

    } catch (error) {
        console.error('ViewOnce command error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Download karne mein problem hui! Shayad media corrupt hai.',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }
}

module.exports = viewonceCommand;