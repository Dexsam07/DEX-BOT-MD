const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');

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

// Paths
const databaseDir = path.join(process.cwd(), 'data');
const warningsPath = path.join(databaseDir, 'warnings.json');

// Ensure warnings file exists
function initializeWarningsFile() {
    if (!fs.existsSync(databaseDir)) fs.mkdirSync(databaseDir, { recursive: true });
    if (!fs.existsSync(warningsPath)) fs.writeFileSync(warningsPath, JSON.stringify({}), 'utf8');
}

async function warnCommand(sock, chatId, senderId, mentionedJids, message) {
    try {
        initializeWarningsFile();

        // Group only
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, {
                text: '⚠️ Ye command sirf group mein use kar sakte ho!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Admin checks
        let isSenderAdmin, isBotAdmin;
        try {
            const adminCheck = await isAdmin(sock, chatId, senderId);
            isSenderAdmin = adminCheck.isSenderAdmin;
            isBotAdmin = adminCheck.isBotAdmin;
        } catch (err) {
            console.error('Admin check error:', err);
            await sock.sendMessage(chatId, {
                text: '❌ Admin status check karne mein problem hui.',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, {
                text: '❌ Bot ko admin banana hoga pehle!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }
        if (!isSenderAdmin && !message.key.fromMe) {
            await sock.sendMessage(chatId, {
                text: '⛔ Sirf group admin hi warn command use kar sakta hai!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Determine user to warn
        let userToWarn = null;
        if (mentionedJids && mentionedJids.length > 0) {
            userToWarn = mentionedJids[0];
        } else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToWarn = message.message.extendedTextMessage.contextInfo.participant;
        }

        if (!userToWarn) {
            await sock.sendMessage(chatId, {
                text: '⚠️ Kisi user ko mention karo ya reply karke .warn likho!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Prevent warning the bot itself
        const botJid = sock.user.id;
        if (userToWarn === botJid) {
            await sock.sendMessage(chatId, {
                text: '🤖 Main khud ko warn nahi kar sakta!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Read current warnings
        let warnings = {};
        try {
            warnings = JSON.parse(fs.readFileSync(warningsPath, 'utf8'));
        } catch {
            warnings = {};
        }

        // Initialize nested structures
        if (!warnings[chatId]) warnings[chatId] = {};
        if (!warnings[chatId][userToWarn]) warnings[chatId][userToWarn] = 0;

        warnings[chatId][userToWarn]++;
        const currentWarns = warnings[chatId][userToWarn];

        // Save updated warnings
        fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2));

        // Prepare warning message
        const warnMsg = `⚠️ *WARNING* ⚠️\n\n` +
            `👤 *User:* @${userToWarn.split('@')[0]}\n` +
            `📊 *Warning Count:* ${currentWarns}/3\n` +
            `👑 *Warned By:* @${senderId.split('@')[0]}\n` +
            `📅 *Date:* ${new Date().toLocaleString()}\n\n` +
            `🔔 *Note:* 3 warnings milne par auto‑kick ho jayega.`;

        await sock.sendMessage(chatId, {
            text: warnMsg,
            mentions: [userToWarn, senderId],
            contextInfo: getNewsletterInfo()
        }, { quoted: message });

        // Auto‑kick at 3 warnings
        if (currentWarns >= 3) {
            try {
                await sock.groupParticipantsUpdate(chatId, [userToWarn], "remove");
                delete warnings[chatId][userToWarn];
                fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2));

                const kickMsg = `🚫 *AUTO‑KICK* 🚫\n\n` +
                    `@${userToWarn.split('@')[0]} ko group se nikaal diya gaya hai kyunki unhe 3 warnings mil gaye! ⚠️`;
                await sock.sendMessage(chatId, {
                    text: kickMsg,
                    mentions: [userToWarn],
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
            } catch (kickErr) {
                console.error('Auto‑kick failed:', kickErr);
                await sock.sendMessage(chatId, {
                    text: `❌ Auto‑kick fail ho gaya. @${userToWarn.split('@')[0]} ko manually kick karna hoga.`,
                    mentions: [userToWarn],
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
            }
        }

    } catch (error) {
        console.error('Warn command error:', error);
        const errorMsg = error?.data === 429
            ? '⏳ Rate limit! Thoda wait karke try karo.'
            : '❌ Warn karne mein problem hui. Bot admin hai aur sahi permissions hain?';
        await sock.sendMessage(chatId, {
            text: errorMsg,
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }
}

module.exports = warnCommand;