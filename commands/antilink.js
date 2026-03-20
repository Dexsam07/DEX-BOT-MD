const { setAntilink, getAntilink, removeAntilink } = require('../lib/index');
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

// Main command handler for .antilink
async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, {
                text: '🔒 *Sirf group admin hi ye command use kar sakta hai!*',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        const prefix = '.';
        const args = userMessage.slice(9).toLowerCase().trim().split(/\s+/);
        const action = args[0];

        if (!action) {
            const usage = `
╔══════════════════════════════╗
║  🤖 *ANTILINK SETUP* 🤖       ║
╠══════════════════════════════╣
║ ${prefix}antilink on          ║
║ ${prefix}antilink off         ║
║ ${prefix}antilink set <mode>  ║
║ ${prefix}antilink set action  ║
║ ${prefix}antilink get         ║
╠══════════════════════════════╣
║ *Modes:*                     ║
║ whatsappGroup, whatsappChannel║
║ telegram, allLinks           ║
║ *Actions:*                   ║
║ delete, kick, warn           ║
╚══════════════════════════════╝
            `.trim();
            await sock.sendMessage(chatId, {
                text: usage,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        switch (action) {
            case 'on': {
                const existing = await getAntilink(chatId);
                if (existing && existing.enabled) {
                    await sock.sendMessage(chatId, {
                        text: '⚠️ *Antilink already ON hai!*',
                        contextInfo: getNewsletterInfo()
                    }, { quoted: message });
                    return;
                }
                const result = await setAntilink(chatId, true, existing?.mode || 'allLinks', existing?.action || 'delete');
                if (result) {
                    await sock.sendMessage(chatId, {
                        text: '✅ *Antilink ON kar diya gaya hai!*',
                        contextInfo: getNewsletterInfo()
                    }, { quoted: message });
                } else {
                    await sock.sendMessage(chatId, {
                        text: '❌ *Antilink ON karne me error aaya.*',
                        contextInfo: getNewsletterInfo()
                    }, { quoted: message });
                }
                break;
            }

            case 'off': {
                await removeAntilink(chatId);
                await sock.sendMessage(chatId, {
                    text: '🔴 *Antilink OFF kar diya gaya hai.*',
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                break;
            }

            case 'set': {
                if (args.length < 2) {
                    await sock.sendMessage(chatId, {
                        text: '⚠️ *Kya set karna hai? Use: .antilink set mode <mode> ya .antilink set action <action>*',
                        contextInfo: getNewsletterInfo()
                    }, { quoted: message });
                    return;
                }
                const subCmd = args[1];
                const value = args[2];

                if (subCmd === 'mode') {
                    if (!['whatsappGroup', 'whatsappChannel', 'telegram', 'allLinks'].includes(value)) {
                        await sock.sendMessage(chatId, {
                            text: '❌ *Invalid mode! Options: whatsappGroup, whatsappChannel, telegram, allLinks*',
                            contextInfo: getNewsletterInfo()
                        }, { quoted: message });
                        return;
                    }
                    const current = await getAntilink(chatId);
                    const enabled = current ? current.enabled : false;
                    const actionSetting = current ? current.action : 'delete';
                    await setAntilink(chatId, enabled, value, actionSetting);
                    await sock.sendMessage(chatId, {
                        text: `✅ *Mode set kar diya: ${value}*`,
                        contextInfo: getNewsletterInfo()
                    }, { quoted: message });
                } else if (subCmd === 'action') {
                    if (!['delete', 'kick', 'warn'].includes(value)) {
                        await sock.sendMessage(chatId, {
                            text: '❌ *Invalid action! Options: delete, kick, warn*',
                            contextInfo: getNewsletterInfo()
                        }, { quoted: message });
                        return;
                    }
                    const current = await getAntilink(chatId);
                    const enabled = current ? current.enabled : false;
                    const mode = current ? current.mode : 'allLinks';
                    await setAntilink(chatId, enabled, mode, value);
                    await sock.sendMessage(chatId, {
                        text: `✅ *Action set kar diya: ${value}*`,
                        contextInfo: getNewsletterInfo()
                    }, { quoted: message });
                } else {
                    await sock.sendMessage(chatId, {
                        text: '⚠️ *Use: .antilink set mode <mode> ya .antilink set action <action>*',
                        contextInfo: getNewsletterInfo()
                    }, { quoted: message });
                }
                break;
            }

            case 'get': {
                const config = await getAntilink(chatId);
                if (!config) {
                    await sock.sendMessage(chatId, {
                        text: '📭 *Antilink currently OFF hai.*',
                        contextInfo: getNewsletterInfo()
                    }, { quoted: message });
                    return;
                }
                const statusText = config.enabled ? 'ON ✅' : 'OFF ❌';
                const modeText = config.mode || 'Not set';
                const actionText = config.action || 'Not set';
                await sock.sendMessage(chatId, {
                    text: `
╔══════════════════════════════╗
║  📊 *ANTILINK CONFIG* 📊      ║
╠══════════════════════════════╣
║ Status   : ${statusText}
║ Mode     : ${modeText}
║ Action   : ${actionText}
╚══════════════════════════════╝
                    `.trim(),
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                break;
            }

            default:
                await sock.sendMessage(chatId, {
                    text: `⚠️ *Unknown command. Use ${prefix}antilink for help.*`,
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
        }
    } catch (error) {
        console.error('Antilink command error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ *Kuch gadbad ho gayi. Try again later.*',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }
}

// Link detection and action execution
async function handleLinkDetection(sock, chatId, message, userMessage, senderId) {
    try {
        const config = await getAntilink(chatId);
        if (!config || !config.enabled) return;

        const { mode, action } = config;

        // Define regex patterns
        const patterns = {
            whatsappGroup: /chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/i,
            whatsappChannel: /wa\.me\/channel\/[A-Za-z0-9]{20,}/i,
            telegram: /t\.me\/[A-Za-z0-9_]+/i,
            allLinks: /https?:\/\/\S+|www\.\S+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/i
        };

        let matched = false;
        if (mode === 'allLinks') {
            matched = patterns.allLinks.test(userMessage);
        } else if (patterns[mode]) {
            matched = patterns[mode].test(userMessage);
        }

        if (!matched) return;

        // Get message details
        const msgId = message.key.id;
        const participant = message.key.participant || senderId;

        // Execute action
        switch (action) {
            case 'delete':
                try {
                    await sock.sendMessage(chatId, {
                        delete: { remoteJid: chatId, fromMe: false, id: msgId, participant }
                    });
                    const warnMsg = `⚠️ *@${senderId.split('@')[0]}, link daalna mana hai!* 🚫\nPehli baar warning hai, agli baar action hoga.`;
                    await sock.sendMessage(chatId, {
                        text: warnMsg,
                        mentions: [senderId],
                        contextInfo: getNewsletterInfo()
                    });
                } catch (e) {
                    console.error('Delete failed:', e);
                }
                break;

            case 'kick':
                try {
                    await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                    const kickMsg = `👋 *@${senderId.split('@')[0]}, aapko group se nikaal diya gaya hai kyunki aapne link daala.*\nRules follow karo please! 🙏`;
                    await sock.sendMessage(chatId, {
                        text: kickMsg,
                        mentions: [senderId],
                        contextInfo: getNewsletterInfo()
                    });
                } catch (e) {
                    console.error('Kick failed:', e);
                    // Fallback: just delete the message
                    try {
                        await sock.sendMessage(chatId, {
                            delete: { remoteJid: chatId, fromMe: false, id: msgId, participant }
                        });
                        await sock.sendMessage(chatId, {
                            text: `⚠️ *@${senderId.split('@')[0]}, link daalna mana hai! (Kick failed, so just warning)*`,
                            mentions: [senderId],
                            contextInfo: getNewsletterInfo()
                        });
                    } catch {}
                }
                break;

            case 'warn':
                try {
                    await sock.sendMessage(chatId, {
                        delete: { remoteJid: chatId, fromMe: false, id: msgId, participant }
                    });
                    const warnText = `⚠️ *@${senderId.split('@')[0]}, link daalna mana hai!* 🤐\nAgar dubara kiya to action hoga.`;
                    await sock.sendMessage(chatId, {
                        text: warnText,
                        mentions: [senderId],
                        contextInfo: getNewsletterInfo()
                    });
                } catch (e) {
                    console.error('Warn delete failed:', e);
                }
                break;
        }
    } catch (err) {
        console.error('Link detection error:', err);
    }
}

module.exports = {
    handleAntilinkCommand,
    handleLinkDetection
};