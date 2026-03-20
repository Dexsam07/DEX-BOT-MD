const { handleWelcome } = require('../lib/welcome');
const { isWelcomeOn, getWelcome, setWelcome, removeWelcome } = require('../lib/index');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const isAdmin = require('../lib/isAdmin');
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

// Default emotional welcome messages in Hinglish
const defaultMessages = [
    "🎉 *{user}* hamare pariwar mein swagat hai! 🏠\n\n{group} mein aapka intezaar tha. Umeed hai aapko yahan maza aayega. 😊\n\n📝 *Group Description:*\n{description}",
    "✨ *{user}* aa gaye! Ab maza ayega! 🔥\n\n{group} mein naye rang bharne aaye ho. Welcome! 💫\n\n📌 *About Group:*\n{description}",
    "🌸 *{user}* ji ka swagat hai! 💐\n\n{group} family ab aur bhi strong. Rules follow karna mat bhoolna! 😇\n\n📋 *Description:*\n{description}",
    "🚀 *{user}* ne entry maar li! 💥\n\n{group} mein naya energy level aa gaya. Enjoy karo! 🎯\n\nℹ️ *Group Info:*\n{description}",
    "💖 *{user}* ko {group} mein dher saara pyaar! ❤️\n\nMilkar group ko aur mazedaar banayenge. Keep smiling! 😄\n\n📖 *Description:*\n{description}"
];

function getRandomDefaultMessage(user, group, desc) {
    const msg = defaultMessages[Math.floor(Math.random() * defaultMessages.length)];
    return msg.replace(/{user}/g, user).replace(/{group}/g, group).replace(/{description}/g, desc);
}

// Generate welcome image using multiple APIs (fallback chain)
async function generateWelcomeImage(userName, groupName, memberCount, avatarUrl) {
    const apis = [
        `https://api.some-random-api.com/welcome/img/2/gaming3?type=join&textcolor=green&username=${encodeURIComponent(userName)}&guildName=${encodeURIComponent(groupName)}&memberCount=${memberCount}&avatar=${encodeURIComponent(avatarUrl)}`,
        `https://api.some-random-api.com/welcome/img/2/gaming2?type=join&textcolor=green&username=${encodeURIComponent(userName)}&guildName=${encodeURIComponent(groupName)}&memberCount=${memberCount}&avatar=${encodeURIComponent(avatarUrl)}`,
        `https://api.some-random-api.com/welcome/img/2/gaming1?type=join&textcolor=green&username=${encodeURIComponent(userName)}&guildName=${encodeURIComponent(groupName)}&memberCount=${memberCount}&avatar=${encodeURIComponent(avatarUrl)}`
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

// Command handler for .welcome
async function welcomeCommand(sock, chatId, message, match) {
    try {
        // Group only
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, {
                text: '⚠️ Ye command sirf group mein use kar sakte ho!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Admin check
        const senderId = message.key.participant || message.key.remoteJid;
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
                text: '⛔ Sirf group admin hi welcome command use kar sakta hai!',
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
                await setWelcome(chatId, true);
                await sock.sendMessage(chatId, {
                    text: '✅ Welcome message enabled! Ab naye members ka swagat hoga.',
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                break;

            case 'off':
                await removeWelcome(chatId);
                await sock.sendMessage(chatId, {
                    text: '❌ Welcome message disabled.',
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                break;

            case 'set':
                const customMsg = parts.slice(2).join(' ');
                if (!customMsg) {
                    await sock.sendMessage(chatId, {
                        text: '⚠️ Kuch likho! Example: .welcome set "Welcome {user} to {group}!"\n\nAvailable placeholders: {user}, {group}, {description}',
                        contextInfo: getNewsletterInfo()
                    }, { quoted: message });
                    return;
                }
                await setWelcome(chatId, true, customMsg);
                await sock.sendMessage(chatId, {
                    text: '✅ Custom welcome message set!',
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                break;

            case 'reset':
                await setWelcome(chatId, true, null);
                await sock.sendMessage(chatId, {
                    text: '✅ Welcome message reset to default emotional quotes!',
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                break;

            case 'status':
                const isEnabled = await isWelcomeOn(chatId);
                const currentMsg = await getWelcome(chatId);
                await sock.sendMessage(chatId, {
                    text: `*Welcome Status*\nEnabled: ${isEnabled ? '✅ Yes' : '❌ No'}\nCustom message: ${currentMsg ? currentMsg : 'Default emotional messages'}`,
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                break;

            default:
                await sock.sendMessage(chatId, {
                    text: `*Welcome Commands*\n.welcome on\n.welcome off\n.welcome set <message>\n.welcome reset\n.welcome status\n\nUse {user}, {group}, {description} in custom message.`,
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
        }
    } catch (err) {
        console.error('Welcome command error:', err);
        await sock.sendMessage(chatId, {
            text: '❌ Kuch gadbad ho gayi!',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }
}

// Event handler for new members
async function handleJoinEvent(sock, id, participants) {
    try {
        const isEnabled = await isWelcomeOn(id);
        if (!isEnabled) return;

        const customMsg = await getWelcome(id);
        const groupMetadata = await sock.groupMetadata(id);
        const groupName = groupMetadata.subject;
        const groupDesc = groupMetadata.desc?.toString() || 'No description available';

        for (const participant of participants) {
            const participantJid = typeof participant === 'string' ? participant : (participant.id || participant.toString());
            if (!participantJid) continue;

            // Get display name
            let displayName = participantJid.split('@')[0];
            try {
                const contact = await sock.getBusinessProfile(participantJid);
                if (contact?.name) displayName = contact.name;
                else {
                    const groupParticipants = groupMetadata.participants;
                    const userPart = groupParticipants.find(p => p.id === participantJid);
                    if (userPart?.name) displayName = userPart.name;
                }
            } catch {}

            // Build final message
            let finalText;
            if (customMsg) {
                finalText = customMsg
                    .replace(/{user}/g, displayName)
                    .replace(/{group}/g, groupName)
                    .replace(/{description}/g, groupDesc);
            } else {
                finalText = getRandomDefaultMessage(displayName, groupName, groupDesc);
            }

            // Try to send image
            let profilePicUrl = null;
            try {
                profilePicUrl = await sock.profilePictureUrl(participantJid, 'image');
            } catch {}
            const imageBuffer = await generateWelcomeImage(displayName, groupName, groupMetadata.participants.length, profilePicUrl || '');
            if (imageBuffer) {
                await sock.sendMessage(id, {
                    image: imageBuffer,
                    caption: finalText,
                    mentions: [participantJid],
                    contextInfo: getNewsletterInfo()
                });
            } else {
                // Fallback to text
                await sock.sendMessage(id, {
                    text: finalText,
                    mentions: [participantJid],
                    contextInfo: getNewsletterInfo()
                });
            }
        }
    } catch (err) {
        console.error('Error in handleJoinEvent:', err);
    }
}

module.exports = { welcomeCommand, handleJoinEvent };