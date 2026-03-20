const axios = require('axios');
const isOwnerOrSudo = require('../lib/isOwner');

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
    command: 'gitclone2',
    aliases: ['githubdl2', 'clone2'],
    category: 'download',
    description: 'Download a GitHub repository as a ZIP file',
    usage: '.gitclone2 <github-link>',

    async handler(sock, message, args, context = {}) {
        const { chatId } = context;
        const senderId = message.key.participant || message.key.remoteJid;

        // Only owner can use (to avoid abuse)
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        if (!message.key.fromMe && !isOwner) {
            await sock.sendMessage(chatId, {
                text: '🔒 Sirf bot owner hi ye command use kar sakta hai!',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        const regex = /(?:https|git)(?::\/\/|@)github\.com[\/:]([^\/:]+)\/(.+)/i;

        try {
            const link = args[0];
            if (!link) {
                await sock.sendMessage(chatId, {
                    text: `❌ *Link missing!*\n\nExample: .gitclone2 https://github.com/Dexsam07/DEX-BOT-MD`,
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                return;
            }

            if (!regex.test(link)) {
                await sock.sendMessage(chatId, {
                    text: '⚠️ *Invalid GitHub link!*',
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                return;
            }

            let [_, user, repo] = link.match(regex) || [];
            repo = repo.replace(/.git$/, '');
            const url = `https://api.github.com/repos/${user}/${repo}/zipball`;

            // Get filename from content-disposition
            let filename = `${repo}.zip`;
            try {
                const headRes = await axios.head(url);
                const contentDisposition = headRes.headers['content-disposition'];
                if (contentDisposition) {
                    const match = contentDisposition.match(/attachment; filename=(.*)/);
                    if (match) filename = match[1];
                }
            } catch (headErr) {
                console.log('Could not get filename, using default');
            }

            await sock.sendMessage(chatId, {
                text: `⏱️ *Fetching repository...*\n📦 ${user}/${repo}`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });

            await sock.sendMessage(chatId, {
                document: { url: url },
                fileName: filename,
                mimetype: 'application/zip',
                caption: `📦 *Repository:* ${user}/${repo}\n✨ *Cloned by DEX-BOT-MD*`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });

        } catch (err) {
            console.error('Gitclone2 Error:', err);
            await sock.sendMessage(chatId, {
                text: '❌ *Download fail!* Check ki repo public hai ya link sahi hai.',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        }
    }
};