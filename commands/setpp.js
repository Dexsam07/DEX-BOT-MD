const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const isOwnerOrSudo = require('../lib/isOwner');

// Helper for newsletter context (makes messages look forwarded)
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

async function setProfilePicture(sock, chatId, msg) {
    let imagePath = null;
    try {
        const senderId = msg.key.participant || msg.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        if (!msg.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, {
                text: '❌ This command is only available for the owner!',
                contextInfo: getNewsletterInfo()
            }, { quoted: msg });
            return;
        }

        // Check if the message is a reply to an image
        const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMessage) {
            await sock.sendMessage(chatId, {
                text: '⚠️ Please reply to an image with the `.setpp` command!',
                contextInfo: getNewsletterInfo()
            }, { quoted: msg });
            return;
        }

        // Only allow image messages (sticker not supported for profile picture)
        const imageMessage = quotedMessage.imageMessage;
        if (!imageMessage) {
            await sock.sendMessage(chatId, {
                text: '❌ The replied message must contain an image (not a sticker, video, etc.)!',
                contextInfo: getNewsletterInfo()
            }, { quoted: msg });
            return;
        }

        // Ensure tmp directory exists
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        // Download the image to a temporary file
        const stream = await downloadContentFromMessage(imageMessage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        imagePath = path.join(tmpDir, `profile_${Date.now()}.jpg`);
        await fs.promises.writeFile(imagePath, buffer);

        // Update the bot's profile picture
        await sock.updateProfilePicture(sock.user.id, { url: imagePath });

        // Clean up the temporary file
        await fs.promises.unlink(imagePath);

        await sock.sendMessage(chatId, {
            text: '✅ Successfully updated bot profile picture!',
            contextInfo: getNewsletterInfo()
        }, { quoted: msg });

    } catch (error) {
        console.error('Error in setpp command:', error);
        // Clean up temporary file if it exists and an error occurred
        if (imagePath && fs.existsSync(imagePath)) {
            try { await fs.promises.unlink(imagePath); } catch (e) {}
        }
        await sock.sendMessage(chatId, {
            text: '❌ Failed to update profile picture. Make sure the image is valid and I have the necessary permissions.',
            contextInfo: getNewsletterInfo()
        }, { quoted: msg });
    }
}

module.exports = setProfilePicture;