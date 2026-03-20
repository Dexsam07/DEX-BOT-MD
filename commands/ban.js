const fs = require('fs');
const path = require('path');
const { channelInfo } = require('../lib/messageConfig');
const isAdmin = require('../lib/isAdmin');
const { isSudo } = require('../lib/index');
const settings = require('../settings');

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

// Path to banned users file
const DATA_DIR = path.join(__dirname, '../data');
const BANNED_FILE = path.join(DATA_DIR, 'banned.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BANNED_FILE)) fs.writeFileSync(BANNED_FILE, '[]');

// Helper to load banned list
function loadBanned() {
    try {
        const data = fs.readFileSync(BANNED_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// Helper to save banned list
function saveBanned(banned) {
    try {
        fs.writeFileSync(BANNED_FILE, JSON.stringify(banned, null, 2));
        return true;
    } catch {
        return false;
    }
}

async function banCommand(sock, chatId, message) {
    try {
        const isGroup = chatId.endsWith('@g.us');
        const senderId = message.key.participant || message.key.remoteJid;

        // Permission checks
        if (isGroup) {
            const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
            if (!isBotAdmin) {
                await sock.sendMessage(chatId, {
                    text: '❌ *Bot ko admin banana hoga pehle!*',
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                return;
            }
            if (!isSenderAdmin && !message.key.fromMe) {
                await sock.sendMessage(chatId, {
                    text: '⛔ *Sirf group admin hi .ban use kar sakta hai!*',
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                return;
            }
        } else {
            const senderIsSudo = await isSudo(senderId);
            if (!message.key.fromMe && !senderIsSudo) {
                await sock.sendMessage(chatId, {
                    text: '🔒 *Sirf bot owner/sudo private chat me .ban use kar sakta hai.*',
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                return;
            }
        }

        // Determine target user
        let userToBan = null;
        const ctxInfo = message.message?.extendedTextMessage?.contextInfo || {};
        if (ctxInfo.mentionedJid?.length > 0) {
            userToBan = ctxInfo.mentionedJid[0];
        } else if (ctxInfo.participant) {
            userToBan = ctxInfo.participant;
        }

        if (!userToBan) {
            await sock.sendMessage(chatId, {
                text: '⚠️ *Kisi user ko mention karo ya reply karke .ban likho!*\nExample: `.ban @user`',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Prevent banning the bot itself
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const botLid = sock.user.lid || '';
        if (userToBan === botId || userToBan === botLid || userToBan.split('@')[0] === botId.split('@')[0]) {
            await sock.sendMessage(chatId, {
                text: '🤖 *Main khud ko ban nahi kar sakta!*',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Load current banned list
        let banned = loadBanned();
        if (!banned.includes(userToBan)) {
            banned.push(userToBan);
            if (saveBanned(banned)) {
                await sock.sendMessage(chatId, {
                    text: `✅ *@${userToBan.split('@')[0]} ko ban kar diya gaya hai!*\nAb ye bot ke saare commands use nahi kar sakta.`,
                    mentions: [userToBan],
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, {
                    text: '❌ *Ban karne me error aaya. File permission check karo.*',
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
            }
        } else {
            await sock.sendMessage(chatId, {
                text: `⚠️ *@${userToBan.split('@')[0]} already banned hai!*`,
                mentions: [userToBan],
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        }
    } catch (error) {
        console.error('Ban command error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ *Kuch gadbad ho gayi. Try again later.*',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }
}

module.exports = banCommand;