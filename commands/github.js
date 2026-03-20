const moment = require('moment-timezone');
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

// Helper to get repository info (configurable)
function getRepoInfo() {
    // You can set these in settings.js if you want
    const owner = settings.githubOwner || 'Dexsam07';
    const repo = settings.githubRepo || 'DEX-BOT-MD';
    return { owner, repo, apiUrl: `https://api.github.com/repos/${owner}/${repo}` };
}

async function githubCommand(sock, chatId, message) {
    try {
        const { owner, repo, apiUrl } = getRepoInfo();
        const res = await fetch(apiUrl);
        if (!res.ok) {
            throw new Error(`GitHub API returned ${res.status}`);
        }
        const json = await res.json();

        // Format the stats
        const txt = `╔══════════════════════════════════╗
║      📦 *GITHUB REPOSITORY* 📦     ║
╠══════════════════════════════════╣
║ ✩ *Name*       : ${json.name}
║ ✩ *Owner*      : ${owner}
║ ✩ *Stars*      : ${json.stargazers_count} ⭐
║ ✩ *Forks*      : ${json.forks_count} 🍴
║ ✩ *Watchers*   : ${json.watchers_count} 👀
║ ✩ *Size*       : ${(json.size / 1024).toFixed(2)} MB
║ ✩ *Updated*    : ${moment(json.updated_at).format('DD/MM/YY - HH:mm:ss')}
║ ✩ *URL*        : ${json.html_url}
╚══════════════════════════════════╝
💥 *DEX SHAYAM TECH - Powering WhatsApp*`;

        // Image fallback: use default if bot_image.jpg doesn't exist
        const imgPath = path.join(__dirname, '../assets/bot_image.jpg');
        let imgBuffer;
        if (fs.existsSync(imgPath)) {
            imgBuffer = fs.readFileSync(imgPath);
        } else {
            // Fallback: use a default image from GitHub or any placeholder
            const defaultImg = 'https://i.imgur.com/2wzGhpF.jpeg';
            const imgRes = await fetch(defaultImg);
            imgBuffer = await imgRes.buffer();
        }

        await sock.sendMessage(chatId, {
            image: imgBuffer,
            caption: txt,
            contextInfo: getNewsletterInfo()
        }, { quoted: message });

    } catch (error) {
        console.error('GitHub command error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Repository info fetch karne mein problem hui. Check internet ya repo sahi hai?',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }
}

module.exports = githubCommand;