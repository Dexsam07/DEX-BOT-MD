const { handleGoodbye } = require('../lib/welcome'); // expects this to handle command
const { isGoodByeOn, getGoodbye, setGoodbye, removeGoodbye } = require('../lib/index');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
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

// Emotional goodbye messages in Hinglish
const emotionalMessages = [
    "💔 *{user}* chale gaye? Dil toot gaya! 🥺\nPhir bhi group {group} aapka wait karega. ❤️",
    "😢 *{user}* ne group chhod diya... Itna pyaar tha fir bhi? 💔\nHum miss karenge aapko! ✨",
    "🚪 *{user}* ne door bell baja kar exit le li! 🔔\n{group} ki yaadein saath le jana! 🌟",
    "🕊️ *{user}* alvida! Aapki kami khale gi. 😔\nJab bhi mann kare wapas aa jana. 🏠",
    "💫 *{user}* ke bina group adhoora sa lagta hai... 😥\nPhir milenge! Until then, take care! 🤗",
    "😭 *{user}* humein akela chhod ke ja rahe ho? Itna dard? 💔\nJaldi wapas aana! 🚀",
    "🍃 *{user}* ne group se nikal liya... Jaise patjhad mein patta girta hai. 🍂\nYaadein saath rahegi! 📝",
    "🌙 *{user}* ne group ko chandni raat mein chhod diya... 🥀\nAapki roshni kabhi na bhoolenge! ✨",
    "😔 *{user}* ki chali gayi... Ab group suna suna lagta hai. 🎵\nPhir se aao! 🤝",
    "💎 *{user}* group ka ek anmol hissa the... 🏆\nJaane se pehle alvida keh do! 👋"
];

function getRandomEmotionalMessage(userName, groupName) {
    const msg = emotionalMessages[Math.floor(Math.random() * emotionalMessages.length)];
    return msg.replace(/{user}/g, userName).replace(/{group}/g, groupName);
}

// Helper: get user display name (async)
async function getUserDisplayName(sock, jid, groupMetadata) {
    try {
        // Try to get from group participants
        const participant = groupMetadata?.participants?.find(p => p.id === jid);
        if (participant?.name) return participant.name;

        // Try business profile (for non-group)
        const profile = await sock.getBusinessProfile(jid);
        if (profile?.name) return profile.name;

        // Fallback to phone number
        return jid.split('@')[0];
    } catch {
        return jid.split('@')[0];
    }
}

// Generate goodbye image using multiple API endpoints (fallback)
async function generateGoodbyeImage(userName, groupName, memberCount, avatarUrl) {
    const apis = [
        `https://api.some-random-api.com/welcome/img/2/gaming1?type=leave&textcolor=red&username=${encodeURIComponent(userName)}&guildName=${encodeURIComponent(groupName)}&memberCount=${memberCount}&avatar=${encodeURIComponent(avatarUrl)}`,
        `https://api.some-random-api.com/welcome/img/2/gaming2?type=leave&textcolor=red&username=${encodeURIComponent(userName)}&guildName=${encodeURIComponent(groupName)}&memberCount=${memberCount}&avatar=${encodeURIComponent(avatarUrl)}`,
        `https://api.some-random-api.com/welcome/img/2/gaming3?type=leave&textcolor=red&username=${encodeURIComponent(userName)}&guildName=${encodeURIComponent(groupName)}&memberCount=${memberCount}&avatar=${encodeURIComponent(avatarUrl)}`
    ];
    for (const api of apis) {
        try {
            const response = await fetch(api);
            if (response.ok) {
                return await response.buffer();
            }
        } catch (err) {
            console.log(`Image API failed: ${api}`);
        }
    }
    return null;
}

// Command handler for .goodbye (admin only)
async function goodbyeCommand(sock, chatId, message, match) {
    try {
        // Check if it's a group
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, {
                text: '⚠️ Ye command sirf group mein use kar sakte ho!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Admin check
        const senderId = message.key.participant || message.key.remoteJid;
        const isGroupAdmin = await require('../lib/isAdmin')(sock, chatId, senderId).then(r => r.isSenderAdmin);
        if (!isGroupAdmin && !message.key.fromMe) {
            await sock.sendMessage(chatId, {
                text: '⛔ Sirf group admin hi .goodbye command use kar sakta hai!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Parse arguments
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const parts = text.trim().split(/\s+/);
        const action = parts[1]?.toLowerCase();

        switch (action) {
            case 'on':
                await setGoodbye(chatId, true);
                await sock.sendMessage(chatId, {
                    text: '✅ *Goodbye message enabled!* Ab jab koi group chhodta hai to message bheja jayega.',
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                break;

            case 'off':
                await removeGoodbye(chatId);
                await sock.sendMessage(chatId, {
                    text: '❌ *Goodbye message disabled!*',
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                break;

            case 'set':
                const customMsg = parts.slice(2).join(' ');
                if (!customMsg) {
                    await sock.sendMessage(chatId, {
                        text: '⚠️ Kuch likho! Example: .goodbye set "{user} chala gaya 😢"',
                        contextInfo: getNewsletterInfo()
                    }, { quoted: message });
                    return;
                }
                await setGoodbye(chatId, true, customMsg);
                await sock.sendMessage(chatId, {
                    text: `✅ Custom goodbye message set!`,
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                break;

            case 'reset':
                await setGoodbye(chatId, true, null);
                await sock.sendMessage(chatId, {
                    text: '✅ Goodbye message reset to default emotional quotes!',
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                break;

            case 'status':
                const isEnabled = await isGoodByeOn(chatId);
                const currentMsg = await getGoodbye(chatId);
                await sock.sendMessage(chatId, {
                    text: `*Goodbye Status*\nEnabled: ${isEnabled ? '✅ Yes' : '❌ No'}\nCustom message: ${currentMsg ? currentMsg : 'Default emotional messages'}`,
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                break;

            default:
                await sock.sendMessage(chatId, {
                    text: `*Goodbye Commands*\n.goodbye on\n.goodbye off\n.goodbye set <message>\n.goodbye reset\n.goodbye status\n\nUse {user} for username, {group} for group name.`,
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
        }
    } catch (err) {
        console.error('Goodbye command error:', err);
        await sock.sendMessage(chatId, {
            text: '❌ Kuch gadbad ho gayi!',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }
}

// Handle when someone leaves the group
async function handleLeaveEvent(sock, id, participants) {
    try {
        const isEnabled = await isGoodByeOn(id);
        if (!isEnabled) return;

        const customMsg = await getGoodbye(id);
        const groupMetadata = await sock.groupMetadata(id);
        const groupName = groupMetadata.subject;

        for (const participant of participants) {
            const participantJid = typeof participant === 'string' ? participant : participant.id;
            if (!participantJid) continue;

            const displayName = await getUserDisplayName(sock, participantJid, groupMetadata);
            const userName = displayName.split(' ')[0]; // first name

            // Determine final message
            let finalText;
            if (customMsg) {
                finalText = customMsg
                    .replace(/{user}/g, displayName)
                    .replace(/{group}/g, groupName);
            } else {
                finalText = getRandomEmotionalMessage(displayName, groupName);
            }

            // Try to send an image first
            let profilePicUrl = null;
            try {
                const pp = await sock.profilePictureUrl(participantJid, 'image');
                profilePicUrl = pp;
            } catch {}

            const imageBuffer = await generateGoodbyeImage(displayName, groupName, groupMetadata.participants.length, profilePicUrl || '');
            if (imageBuffer) {
                await sock.sendMessage(id, {
                    image: imageBuffer,
                    caption: finalText,
                    mentions: [participantJid],
                    contextInfo: getNewsletterInfo()
                });
            } else {
                // Fallback to text only
                await sock.sendMessage(id, {
                    text: finalText,
                    mentions: [participantJid],
                    contextInfo: getNewsletterInfo()
                });
            }
        }
    } catch (err) {
        console.error('Error in handleLeaveEvent:', err);
        // Don't crash the bot
    }
}

module.exports = { goodbyeCommand, handleLeaveEvent };