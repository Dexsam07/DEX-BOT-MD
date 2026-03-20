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

// Store active timeouts to prevent duplicate unmute attempts
const muteTimeouts = new Map();

async function muteCommand(sock, chatId, senderId, message, args) {
    try {
        // Ensure it's a group
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, {
                text: '⚠️ Ye command sirf group mein use kar sakte ho!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Check admin permissions
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        if (!isBotAdmin) {
            await sock.sendMessage(chatId, {
                text: '❌ Bot ko admin banana hoga pehle!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }
        if (!isSenderAdmin && !message.key.fromMe) {
            await sock.sendMessage(chatId, {
                text: '⛔ Sirf group admin hi mute command use kar sakta hai!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Parse command arguments
        const commandName = args[0]?.toLowerCase();
        const durationArg = args[1] ? parseInt(args[1]) : null;

        // Get current group settings
        const groupMetadata = await sock.groupMetadata(chatId);
        const isCurrentlyMuted = groupMetadata.announce === true; // true = only admins can send (muted)

        // Handle unmute command
        if (commandName === 'unmute') {
            if (!isCurrentlyMuted) {
                await sock.sendMessage(chatId, {
                    text: '🔊 Group already unmuted hai! Sab bhej sakte hain.',
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                return;
            }
            await sock.groupSettingUpdate(chatId, 'not_announcement');
            // Clear any pending timeout
            if (muteTimeouts.has(chatId)) {
                clearTimeout(muteTimeouts.get(chatId));
                muteTimeouts.delete(chatId);
            }
            await sock.sendMessage(chatId, {
                text: '✅ Group unmute kar diya gaya! Ab sab message bhej sakte hain.',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Handle status command
        if (commandName === 'status') {
            await sock.sendMessage(chatId, {
                text: isCurrentlyMuted
                    ? '🔇 Group currently muted hai. Sirf admin message bhej sakte hain.'
                    : '🔊 Group unmuted hai. Sab message bhej sakte hain.',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Otherwise, it's a mute command
        if (isCurrentlyMuted) {
            await sock.sendMessage(chatId, {
                text: '🔇 Group already muted hai. Pehle unmute karo agar change karna hai.',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Mute the group
        await sock.groupSettingUpdate(chatId, 'announcement');

        // If duration provided, set a timeout to unmute
        let durationMsg = '';
        if (durationArg && !isNaN(durationArg) && durationArg > 0) {
            const minutes = Math.min(durationArg, 1440); // max 24 hours
            const ms = minutes * 60 * 1000;
            if (muteTimeouts.has(chatId)) clearTimeout(muteTimeouts.get(chatId));
            const timeout = setTimeout(async () => {
                try {
                    await sock.groupSettingUpdate(chatId, 'not_announcement');
                    await sock.sendMessage(chatId, {
                        text: '⏰ Auto-unmute: Group unmute ho gaya (time complete).',
                        contextInfo: getNewsletterInfo()
                    });
                    muteTimeouts.delete(chatId);
                } catch (err) {
                    console.error('Auto-unmute failed:', err);
                }
            }, ms);
            muteTimeouts.set(chatId, timeout);
            durationMsg = ` for ${minutes} minute${minutes !== 1 ? 's' : ''}`;
            await sock.sendMessage(chatId, {
                text: `🔇 Group mute kar diya gaya${durationMsg}. Auto-unmute hoga ${minutes} minute baad.`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                text: '🔇 Group mute kar diya gaya. Ab sirf admin message bhej sakte hain.',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        }

    } catch (error) {
        console.error('Error in mute command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Kuch gadbad ho gayi. Try again later.',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }
}

module.exports = muteCommand;