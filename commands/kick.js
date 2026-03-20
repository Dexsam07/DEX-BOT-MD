const isAdmin = require('../lib/isAdmin');

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

/**
 * Kicks users from a group.
 * @param {import('@whiskeysockets/baileys').WASocket} sock - Baileys socket.
 * @param {string} chatId - Group JID.
 * @param {string} senderId - JID of the command sender.
 * @param {Array} mentionedJids - JIDs mentioned in the message.
 * @param {Object} message - The message object.
 */
async function kickCommand(sock, chatId, senderId, mentionedJids, message) {
    try {
        const isOwner = message.key.fromMe;

        // Permission check (if not owner)
        if (!isOwner) {
            const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
            if (!isBotAdmin) {
                await sock.sendMessage(chatId, {
                    text: '❌ Please make the bot an admin first.',
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                return;
            }
            if (!isSenderAdmin) {
                await sock.sendMessage(chatId, {
                    text: '⛔ Only group admins can use the kick command.',
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                return;
            }
        }

        // Determine users to kick: either mentioned or replied user
        let usersToKick = [];
        if (mentionedJids && mentionedJids.length > 0) {
            usersToKick = mentionedJids;
        } else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            // If replying to someone, kick that person
            usersToKick = [message.message.extendedTextMessage.contextInfo.participant];
        }

        if (usersToKick.length === 0) {
            await sock.sendMessage(chatId, {
                text: '⚠️ Please mention the user(s) or reply to their message to kick!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Get group metadata to validate participants and find the bot's JID
        const metadata = await sock.groupMetadata(chatId);
        const participants = metadata.participants || [];

        // Determine the bot's JIDs (there can be multiple representations)
        const botId = sock.user.id;                // e.g., "1234567890@s.whatsapp.net"
        const botLid = sock.user.lid;              // may be present, e.g., "1234567890@lid"
        const botPhoneNumber = botId.split('@')[0]; // numeric part

        // Helper to check if a JID matches the bot
        const isBotJid = (jid) => {
            if (!jid) return false;
            const jidStr = jid.toString();
            // Direct match
            if (jidStr === botId || jidStr === botLid) return true;
            // Compare numeric part
            const numPart = jidStr.split('@')[0];
            if (numPart === botPhoneNumber) return true;
            // Compare LID numeric part (strip possible session suffix like :4)
            if (botLid) {
                const botLidNum = botLid.split('@')[0].split(':')[0];
                const jidLidNum = jidStr.split('@')[0].split(':')[0];
                if (botLidNum === jidLidNum) return true;
            }
            return false;
        };

        // Check if trying to kick the bot
        const isKickingBot = usersToKick.some(jid => isBotJid(jid));
        if (isKickingBot) {
            await sock.sendMessage(chatId, {
                text: '🤖 I can\'t kick myself!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Filter only participants that exist in the group
        const validParticipants = participants.map(p => p.id);
        const validUsersToKick = usersToKick.filter(jid => validParticipants.includes(jid));

        if (validUsersToKick.length === 0) {
            await sock.sendMessage(chatId, {
                text: '⚠️ None of the specified users are in this group.',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Perform the removal
        await sock.groupParticipantsUpdate(chatId, validUsersToKick, 'remove');

        // Prepare success message with usernames (optional: fetch names, but just @mention is fine)
        const usernames = validUsersToKick.map(jid => `@${jid.split('@')[0]}`);
        await sock.sendMessage(chatId, {
            text: `✅ ${usernames.join(', ')} ${validUsersToKick.length === 1 ? 'has' : 'have'} been kicked successfully!`,
            mentions: validUsersToKick,
            contextInfo: getNewsletterInfo()
        });

    } catch (error) {
        console.error('Error in kick command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to kick user(s). Make sure I have admin privileges and the user is in the group.',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }
}

module.exports = kickCommand;