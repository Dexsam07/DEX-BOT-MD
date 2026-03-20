const { isOwnerOrSudo } = require('../lib/isOwner');

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

module.exports = {
    command: 'gitclone',
    aliases: ['githubdl', 'clone'],
    category: 'owner',
    description: 'Download a GitHub repository as zip',
    usage: '.gitclone <url> OR <username> <repo> [branch]',

    async handler(sock, message, args) {
        const chatId = message.key.remoteJid;
        const senderId = message.key.participant || message.key.remoteJid;

        // Only owner can use
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        if (!message.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, {
                text: '🔒 Sirf bot owner hi ye command use kar sakta hai!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        if (!args || args.length === 0) {
            await sock.sendMessage(chatId, {
                text: `*🌟 GitHub Repository Downloader*\n\n*Usage:*\n\n1️⃣ .gitclone https://github.com/user/repo\n2️⃣ .gitclone username repo [branch]\n\n*Example:*\n.gitclone Dexsam07 DEX-BOT-MD main`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        let url = '';
        let repoName = '';
        let branch = 'main'; // default

        // Check if URL format
        if (args[0].startsWith('http')) {
            const inputUrl = args[0].replace(/\.git$/, '');
            const parts = inputUrl.split('/');
            repoName = parts[parts.length - 1];
            url = inputUrl;
            if (!url.endsWith('/')) url += '/';
            branch = args[1] && !args[1].startsWith('http') ? args[1] : 'main';
            url += `archive/refs/heads/${branch}.zip`;
        } 
        // Format: username repo [branch]
        else if (args.length >= 2) {
            const username = args[0];
            const repo = args[1];
            repoName = repo;
            branch = args[2] || 'main';
            url = `https://github.com/${username}/${repo}/archive/refs/heads/${branch}.zip`;
        } 
        else {
            await sock.sendMessage(chatId, {
                text: '❌ Invalid format. Use `.gitclone https://github.com/user/repo` or `.gitclone username repo [branch]`',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        await sock.sendMessage(chatId, {
            text: `⏱️ Fetching \`${repoName}\` (branch: \`${branch}\`)...`,
            contextInfo: getNewsletterInfo()
        }, { quoted: message });

        try {
            // Send the file
            await sock.sendMessage(chatId, {
                document: { url },
                fileName: `${repoName}-${branch}.zip`,
                mimetype: 'application/zip',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        } catch (err) {
            console.error('Gitclone error:', err);
            await sock.sendMessage(chatId, {
                text: `❌ Failed to download \`${repoName}\`. Make sure the repository exists and branch \`${branch}\` is valid.`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        }
    }
};