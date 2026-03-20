const gTTS = require('gtts');
const fs = require('fs');
const path = require('path');

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

// Ensure assets directory exists
const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

async function ttsCommand(sock, chatId, text, message, language = 'en') {
    if (!text || text.trim() === '') {
        await sock.sendMessage(chatId, {
            text: '🎤 *Usage:* .tts <language> <text>\n\nExample: .tts hi Namaste\nExample: .tts en Hello world\n\nSupported languages: en, hi, bn, ta, te, etc.',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
        return;
    }

    const fileName = `tts-${Date.now()}.mp3`;
    const filePath = path.join(assetsDir, fileName);

    try {
        const gtts = new gTTS(text, language);
        await new Promise((resolve, reject) => {
            gtts.save(filePath, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Send audio
        await sock.sendMessage(chatId, {
            audio: { url: filePath },
            mimetype: 'audio/mpeg',
            fileName: `${language}_tts.mp3`,
            contextInfo: getNewsletterInfo()
        }, { quoted: message });

        // Clean up
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
        console.error('TTS error:', err);
        await sock.sendMessage(chatId, {
            text: '❌ TTS generate nahi ho paya. Shayad language support nahi hai ya koi aur error hai.',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
        // Clean up if file was partially created
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
}

module.exports = ttsCommand;