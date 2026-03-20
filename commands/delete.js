const isAdmin = require('../lib/isAdmin');
const store = require('../lib/lightweight_store');

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

async function deleteCommand(sock, chatId, message, senderId) {
    try {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, {
                text: '❌ I need to be an admin to delete messages.',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, {
                text: '⛔ Only admins can use the .delete command.',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Parse command arguments
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const parts = text.trim().split(/\s+/);
        let countArg = null;

        if (parts.length > 1) {
            const maybeNum = parseInt(parts[1], 10);
            if (!isNaN(maybeNum) && maybeNum > 0) {
                countArg = Math.min(maybeNum, 50); // max 50 messages to avoid spam
            }
        }

        const ctxInfo = message.message?.extendedTextMessage?.contextInfo || {};
        const repliedParticipant = ctxInfo.participant || null;
        const repliedMsgId = ctxInfo.stanzaId || null;
        const mentioned = (ctxInfo.mentionedJid && ctxInfo.mentionedJid.length > 0) ? ctxInfo.mentionedJid[0] : null;

        // Determine target and count
        let targetUser = null;
        let deleteGroupMessages = false;
        let finalCount = countArg;

        if (repliedParticipant && repliedMsgId) {
            targetUser = repliedParticipant;
            if (finalCount === null) finalCount = 1;
        } else if (mentioned) {
            targetUser = mentioned;
            if (finalCount === null) finalCount = 1;
        } else if (finalCount !== null) {
            // No user specified but count provided – delete last N messages from group
            deleteGroupMessages = true;
        } else {
            // No user, no count – show usage
            await sock.sendMessage(chatId, {
                text: '❌ *Usage:*\n• `.del 5` – Delete last 5 messages from group\n• `.del 3 @user` – Delete last 3 messages from @user\n• `.del 2` (reply to a message) – Delete last 2 messages from replied user',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Gather messages from store
        const chatMessages = Array.isArray(store.messages[chatId]) ? store.messages[chatId] : [];
        const toDelete = [];
        const seenIds = new Set();

        if (deleteGroupMessages) {
            // Delete last N messages from any user in the group
            for (let i = chatMessages.length - 1; i >= 0 && toDelete.length < finalCount; i--) {
                const m = chatMessages[i];
                if (!seenIds.has(m.key.id) && !m.message?.protocolMessage && !m.key.fromMe && m.key.id !== message.key.id) {
                    toDelete.push(m);
                    seenIds.add(m.key.id);
                }
            }
        } else {
            // Delete from a specific user
            // If replying, first try to delete the exact replied message
            if (repliedMsgId && targetUser) {
                const repliedMsg = chatMessages.find(m => m.key.id === repliedMsgId && (m.key.participant || m.key.remoteJid) === targetUser);
                if (repliedMsg) {
                    toDelete.push(repliedMsg);
                    seenIds.add(repliedMsg.key.id);
                } else {
                    // Not found in store, but we can still attempt to delete it directly
                    try {
                        await sock.sendMessage(chatId, {
                            delete: {
                                remoteJid: chatId,
                                fromMe: false,
                                id: repliedMsgId,
                                participant: repliedParticipant
                            }
                        });
                        finalCount = Math.max(0, finalCount - 1);
                    } catch {}
                }
            }

            // Now gather additional messages (up to finalCount) from targetUser
            for (let i = chatMessages.length - 1; i >= 0 && toDelete.length < finalCount; i--) {
                const m = chatMessages[i];
                const participant = m.key.participant || m.key.remoteJid;
                if (participant === targetUser && !seenIds.has(m.key.id) && !m.message?.protocolMessage) {
                    toDelete.push(m);
                    seenIds.add(m.key.id);
                }
            }
        }

        if (toDelete.length === 0) {
            const errorMsg = deleteGroupMessages
                ? 'No recent messages found in the group to delete.'
                : 'No recent messages found for the target user.';
            await sock.sendMessage(chatId, {
                text: `⚠️ ${errorMsg}`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Delete messages sequentially with a short delay
        for (const m of toDelete) {
            try {
                const msgParticipant = deleteGroupMessages
                    ? (m.key.participant || m.key.remoteJid)
                    : (m.key.participant || targetUser);
                await sock.sendMessage(chatId, {
                    delete: {
                        remoteJid: chatId,
                        fromMe: false,
                        id: m.key.id,
                        participant: msgParticipant
                    }
                });
                await new Promise(resolve => setTimeout(resolve, 300)); // avoid rate limits
            } catch (e) {
                // Ignore individual failures
            }
        }

        // Optional: Send a confirmation (can be removed if you prefer silent deletion)
        await sock.sendMessage(chatId, {
            text: `✅ Deleted ${toDelete.length} message(s).`,
            contextInfo: getNewsletterInfo()
        }, { quoted: message });

    } catch (err) {
        console.error('Delete command error:', err);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to delete messages. Make sure I have admin permissions.',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }
}

module.exports = deleteCommand;