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

// Helper: format date (if available)
function formatDate(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleString('en-IN', { timeZone: settings.timeZone || 'Asia/Kolkata' });
}

async function groupInfoCommand(sock, chatId, msg) {
    try {
        // Ensure it's a group
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, {
                text: '⚠️ Ye command sirf group mein use kar sakte ho!',
                contextInfo: getNewsletterInfo()
            }, { quoted: msg });
            return;
        }

        // Fetch group metadata
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];
        const admins = participants.filter(p => p.admin);
        const ownerJid = groupMetadata.owner || (admins.find(a => a.admin === 'superadmin')?.id) || (chatId.split('-')[0] + '@s.whatsapp.net');

        // Get profile picture (with fallback)
        let ppUrl;
        try {
            ppUrl = await sock.profilePictureUrl(chatId, 'image');
        } catch {
            ppUrl = 'https://i.imgur.com/2wzGhpF.jpeg'; // default group image
        }

        // Prepare admin list with mentions
        const adminList = admins.map((a, i) => `${i + 1}. @${a.id.split('@')[0]}`).join('\n');

        // Group creation time (if available in metadata)
        const createdAt = groupMetadata.creation ? formatDate(groupMetadata.creation) : 'N/A';

        // Lock status (ephemeral, etc.)
        const ephemeral = groupMetadata.ephemeralDuration ? `${groupMetadata.ephemeralDuration / 86400} days` : 'Off';
        const restrict = groupMetadata.restrict ? 'Yes' : 'No';
        const announce = groupMetadata.announce ? 'Yes (only admins can send)' : 'No (everyone can send)';

        // Description (truncate if too long)
        let description = groupMetadata.desc?.toString() || 'No description';
        if (description.length > 200) description = description.slice(0, 200) + '...';

        // Build the info text
        const infoText = `
╔══════════════════════════════════════╗
║         📋 *GROUP INFORMATION*        ║
╠══════════════════════════════════════╣
║ *ID:* ${groupMetadata.id}
║ *Name:* ${groupMetadata.subject}
║ *Members:* ${participants.length}
║ *Owner:* @${ownerJid.split('@')[0]}
║ *Created:* ${createdAt}
║ *Ephemeral:* ${ephemeral}
║ *Restrict:* ${restrict}
║ *Announce:* ${announce}
╠══════════════════════════════════════╣
║ *👥 Admins:*\n${adminList || 'None'}
╠══════════════════════════════════════╣
║ *📌 Description:*\n${description}
╚══════════════════════════════════════╝
        `.trim();

        // Send the message with image and mentions
        await sock.sendMessage(chatId, {
            image: { url: ppUrl },
            caption: infoText,
            mentions: [...admins.map(a => a.id), ownerJid],
            contextInfo: getNewsletterInfo()
        }, { quoted: msg });

    } catch (error) {
        console.error('Error in groupinfo command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Group info fetch karne mein problem hui!',
            contextInfo: getNewsletterInfo()
        }, { quoted: msg });
    }
}

module.exports = groupInfoCommand;