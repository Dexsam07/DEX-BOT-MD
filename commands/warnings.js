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

const warningsFilePath = path.join(__dirname, '../data/warnings.json');

// Load warnings (ensures file exists and returns object)
function loadWarnings() {
    if (!fs.existsSync(warningsFilePath)) {
        fs.writeFileSync(warningsFilePath, JSON.stringify({}), 'utf8');
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(warningsFilePath, 'utf8'));
    } catch {
        return {};
    }
}

async function warningsCommand(sock, chatId, mentionedJidList, message) {
    try {
        // Check if used in a group
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, {
                text: '⚠️ Ye command sirf group mein use kar sakte ho!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Ensure a user is mentioned
        if (mentionedJidList.length === 0) {
            await sock.sendMessage(chatId, {
                text: '⚠️ Kisi user ko mention karo jaise: `.warnings @user`',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        const userToCheck = mentionedJidList[0];
        const warnings = loadWarnings();

        // Get warning count for this group and user
        const groupWarnings = warnings[chatId] || {};
        const count = groupWarnings[userToCheck] || 0;

        // Build message
        const userMention = `@${userToCheck.split('@')[0]}`;
        let warnText = `📊 *WARNING STATUS* 📊\n\n`;
        warnText += `👤 User: ${userMention}\n`;
        warnText += `⚠️ Warnings: ${count}/3\n`;

        // Add warning level indicator
        if (count === 0) {
            warnText += `✅ Safe zone – no warnings.`;
        } else if (count === 1) {
            warnText += `🔔 1 warning – be careful!`;
        } else if (count === 2) {
            warnText += `⚠️ 2 warnings – one more and you'll be kicked!`;
        } else if (count >= 3) {
            warnText += `💀 3 warnings – user has already been kicked (or should be).`;
        }

        await sock.sendMessage(chatId, {
            text: warnText,
            mentions: [userToCheck],
            contextInfo: getNewsletterInfo()
        }, { quoted: message });

    } catch (error) {
        console.error('Error in warnings command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Warnings check karne mein problem hui. Try again later.',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }
}

module.exports = warningsCommand;