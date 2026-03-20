const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

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

// Helper: safely read JSON files (returns fallback if missing or invalid)
function readJsonSafe(filePath, fallback) {
    try {
        if (fs.existsSync(filePath)) {
            const txt = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(txt);
        }
    } catch (_) {
        // ignore – return fallback
    }
    return fallback;
}

// Helper: ensure data directory exists
function ensureDataDir() {
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

async function settingsCommand(sock, chatId, message) {
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);

        // Only bot owner can view settings
        if (!message.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, {
                text: '🔒 Sirf bot owner hi ye command use kar sakta hai!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        ensureDataDir(); // make sure ./data exists
        const dataDir = path.join(__dirname, '../data');

        // Load all configuration files with proper defaults
        const mode = readJsonSafe(`${dataDir}/messageCount.json`, { isPublic: true });
        const autoStatus = readJsonSafe(`${dataDir}/autoStatus.json`, { enabled: false });
        const autoread = readJsonSafe(`${dataDir}/autoread.json`, { enabled: false });
        const autotyping = readJsonSafe(`${dataDir}/autotyping.json`, { enabled: false });
        const pmblocker = readJsonSafe(`${dataDir}/pmblocker.json`, { enabled: false });
        const anticall = readJsonSafe(`${dataDir}/anticall.json`, { enabled: false });
        const userGroupData = readJsonSafe(`${dataDir}/userGroupData.json`, {
            antilink: {},
            antibadword: {},
            welcome: {},
            goodbye: {},
            chatbot: {},
            antitag: {},
            autoReaction: false
        });

        const autoReaction = Boolean(userGroupData.autoReaction);
        const isGroup = chatId.endsWith('@g.us');
        const groupId = isGroup ? chatId : null;

        // Per‑group features
        const antilinkOn = groupId ? Boolean(userGroupData.antilink?.[groupId]) : false;
        const antibadwordOn = groupId ? Boolean(userGroupData.antibadword?.[groupId]) : false;
        const welcomeOn = groupId ? Boolean(userGroupData.welcome?.[groupId]) : false;
        const goodbyeOn = groupId ? Boolean(userGroupData.goodbye?.[groupId]) : false;
        const chatbotOn = groupId ? Boolean(userGroupData.chatbot?.[groupId]) : false;
        const antitagCfg = groupId ? userGroupData.antitag?.[groupId] : null;

        // Build the output message
        const lines = [];
        lines.push('╔══════════════════════════════════════╗');
        lines.push('║        🤖 BOT SETTINGS 🤖            ║');
        lines.push('╠══════════════════════════════════════╣');
        lines.push(`║ Mode         : ${mode.isPublic ? '🌍 Public' : '🔒 Private'}`);
        lines.push(`║ Auto Status  : ${autoStatus.enabled ? '✅ ON' : '❌ OFF'}`);
        lines.push(`║ Autoread     : ${autoread.enabled ? '✅ ON' : '❌ OFF'}`);
        lines.push(`║ Autotyping   : ${autotyping.enabled ? '✅ ON' : '❌ OFF'}`);
        lines.push(`║ PM Blocker   : ${pmblocker.enabled ? '✅ ON' : '❌ OFF'}`);
        lines.push(`║ Anticall     : ${anticall.enabled ? '✅ ON' : '❌ OFF'}`);
        lines.push(`║ Auto‑Reaction: ${autoReaction ? '✅ ON' : '❌ OFF'}`);

        if (groupId) {
            lines.push(`╠══════════════════════════════════════╣`);
            lines.push(`║ *Group:* ${groupId.substring(0, 30)}`);
            lines.push(`║ Antilink    : ${antilinkOn ? '✅ ON' : '❌ OFF'}`);
            if (antilinkOn) {
                const al = userGroupData.antilink[groupId];
                lines.push(`║   └─ action: ${al.action || 'delete'}`);
            }
            lines.push(`║ Antibadword : ${antibadwordOn ? '✅ ON' : '❌ OFF'}`);
            if (antibadwordOn) {
                const ab = userGroupData.antibadword[groupId];
                lines.push(`║   └─ action: ${ab.action || 'delete'}`);
            }
            lines.push(`║ Welcome     : ${welcomeOn ? '✅ ON' : '❌ OFF'}`);
            lines.push(`║ Goodbye     : ${goodbyeOn ? '✅ ON' : '❌ OFF'}`);
            lines.push(`║ Chatbot     : ${chatbotOn ? '✅ ON' : '❌ OFF'}`);
            lines.push(`║ Antitag     : ${antitagCfg?.enabled ? '✅ ON' : '❌ OFF'}`);
            if (antitagCfg?.enabled) {
                lines.push(`║   └─ action: ${antitagCfg.action || 'delete'}`);
            }
        } else {
            lines.push(`╠══════════════════════════════════════╣`);
            lines.push(`║ ℹ️ Group settings dikhane ke liye     ║`);
            lines.push(`║    group mein command use karo.      ║`);
        }

        lines.push(`╚══════════════════════════════════════╝`);
        lines.push('');
        lines.push('⚡ Use `.help` for all commands.');

        await sock.sendMessage(chatId, {
            text: lines.join('\n'),
            contextInfo: getNewsletterInfo()
        }, { quoted: message });

    } catch (error) {
        console.error('❌ Error in settings command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Settings fetch karne mein problem hui. Try again later.',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }
}

module.exports = settingsCommand;