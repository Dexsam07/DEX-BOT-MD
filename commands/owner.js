const settings = require('../settings');

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

module.exports = {
    command: 'owner',
    aliases: ['creator', 'dev'],
    category: 'info',
    description: 'Get the contact of the bot owner(s)',
    usage: '.owner',
    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;
        try {
            // Support multiple owners (if settings.ownerNumber is an array) or single owner
            const owners = Array.isArray(settings.ownerNumber) ? settings.ownerNumber : [settings.ownerNumber];
            const botOwners = Array.isArray(settings.botOwner) ? settings.botOwner : [settings.botOwner];

            if (owners.length === 0) {
                throw new Error('No owner configured.');
            }

            // Build contact cards for each owner
            const contacts = [];
            for (let i = 0; i < owners.length; i++) {
                const ownerNumber = owners[i];
                const displayName = botOwners[i] || `Owner ${i + 1}`;
                const vcard = `
BEGIN:VCARD
VERSION:3.0
FN:${displayName}
TEL;waid=${ownerNumber}:${ownerNumber}
END:VCARD
                `.trim();
                contacts.push({ vcard, displayName });
            }

            // Send contact cards
            await sock.sendMessage(chatId, {
                contacts: {
                    displayName: contacts.length === 1 ? contacts[0].displayName : 'Bot Owners',
                    contacts: contacts.map(c => ({ vcard: c.vcard }))
                },
                contextInfo: getNewsletterInfo()
            }, { quoted: message });

        } catch (error) {
            console.error('Owner Command Error:', error);
            // Fallback: send plain text with owner info
            const ownersText = Array.isArray(settings.ownerNumber)
                ? settings.ownerNumber.join(', ')
                : settings.ownerNumber;
            await sock.sendMessage(chatId, {
                text: `👑 *Bot Owner(s)*: ${ownersText}\n\nContact via WhatsApp if needed.`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        }
    }
};