const { isAdmin } = require('../lib/isAdmin');

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

// Manual promotion command
async function promoteCommand(sock, chatId, mentionedJids, message) {
    try {
        // Ensure it's a group
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, {
                text: '⚠️ Ye command sirf group mein use kar sakte ho!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Get sender info
        const senderId = message.key.participant || message.key.remoteJid;

        // Admin checks
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
                text: '⛔ Sirf group admin hi promote command use kar sakta hai!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Determine users to promote
        let usersToPromote = [];
        const ctxInfo = message.message?.extendedTextMessage?.contextInfo || {};

        if (mentionedJids && mentionedJids.length > 0) {
            usersToPromote = mentionedJids;
        } else if (ctxInfo.participant) {
            usersToPromote = [ctxInfo.participant];
        }

        if (usersToPromote.length === 0) {
            await sock.sendMessage(chatId, {
                text: '⚠️ Kisi user ko mention karo ya reply karke .promote likho!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Get group metadata to check current admins
        const groupMetadata = await sock.groupMetadata(chatId);
        const currentAdmins = groupMetadata.participants.filter(p => p.admin).map(p => p.id);

        // Filter out users who are already admins
        const alreadyAdmins = usersToPromote.filter(jid => currentAdmins.includes(jid));
        const validUsers = usersToPromote.filter(jid => !currentAdmins.includes(jid));

        if (validUsers.length === 0) {
            const alreadyMsg = alreadyAdmins.map(jid => `@${jid.split('@')[0]}`).join(', ');
            await sock.sendMessage(chatId, {
                text: `⚠️ ${alreadyMsg} already admin hai!`,
                mentions: alreadyAdmins,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Prevent promoting the bot itself
        const botJid = sock.user.id;
        if (validUsers.includes(botJid)) {
            await sock.sendMessage(chatId, {
                text: '🤖 Main khud ko promote nahi kar sakta!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Perform promotion
        await sock.groupParticipantsUpdate(chatId, validUsers, "promote");

        // Prepare success message
        const usernames = validUsers.map(jid => `@${jid.split('@')[0]}`);
        const promoter = `@${senderId.split('@')[0]}`;
        const promotionMsg = `✨ *PROMOTION SUCCESSFUL* ✨\n\n` +
            `👥 ${validUsers.length > 1 ? 'Promoted Users' : 'Promoted User'}:\n` +
            `${usernames.map(name => `• ${name}`).join('\n')}\n\n` +
            `👑 Promoted By: ${promoter}\n` +
            `📅 Date: ${new Date().toLocaleString()}\n\n` +
            `🎉 Ab ye bhi admin ban gaye!`;

        await sock.sendMessage(chatId, {
            text: promotionMsg,
            mentions: [...validUsers, senderId],
            contextInfo: getNewsletterInfo()
        }, { quoted: message });

    } catch (error) {
        console.error('Error in promote command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Promote karne mein problem hui! Try again later.',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }
}

// Automatic promotion event handler (when someone is promoted via WhatsApp)
async function handlePromotionEvent(sock, groupId, participants, author) {
    try {
        if (!Array.isArray(participants) || participants.length === 0) return;

        // Convert participants to JID strings
        const promotedJids = participants.map(p => typeof p === 'string' ? p : (p.id || p.toString()));
        const authorJid = author ? (typeof author === 'string' ? author : (author.id || author.toString())) : null;

        // Prepare mentions
        const mentions = [...promotedJids];
        if (authorJid) mentions.push(authorJid);

        // Get usernames for display
        const usernames = promotedJids.map(jid => `@${jid.split('@')[0]}`);

        const promotedBy = authorJid ? `@${authorJid.split('@')[0]}` : 'System';

        const promotionMessage = `✨ *GROUP PROMOTION* ✨\n\n` +
            `👥 ${promotedJids.length > 1 ? 'Promoted Users' : 'Promoted User'}:\n` +
            `${usernames.map(name => `• ${name}`).join('\n')}\n\n` +
            `👑 Promoted By: ${promotedBy}\n` +
            `📅 Date: ${new Date().toLocaleString()}`;

        await sock.sendMessage(groupId, {
            text: promotionMessage,
            mentions,
            contextInfo: getNewsletterInfo()
        });
    } catch (error) {
        console.error('Error handling promotion event:', error);
    }
}

module.exports = { promoteCommand, handlePromotionEvent };