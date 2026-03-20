const settings = require('../settings');
const os = require('os');

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

// Helper: format uptime in seconds to human-readable string
function formatUptime(seconds) {
    const days = Math.floor(seconds / (24 * 3600));
    seconds %= 24 * 3600;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);
    return parts.join(' ') || '0s';
}

// Helper: format memory in bytes to MB/GB
function formatMemory(bytes) {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(2)} MB`;
}

async function aliveCommand(sock, chatId, message) {
    try {
        // System stats
        const uptimeSec = process.uptime();
        const uptimeFormatted = formatUptime(uptimeSec);
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(1);
        const platform = `${os.platform()} ${os.release()}`;
        const cpuCores = os.cpus().length;

        // Build the alive message with sections
        const aliveText = `
╔══════════════════════════════════════════╗
║           🌟 DEX BOT IS ALIVE 🌟          ║
╠══════════════════════════════════════════╣
║  📌 Version   : ${settings.version || '5.0.0'}
║  📡 Status    : 🟢 Online & Ready
║  ⏱️ Uptime    : ${uptimeFormatted}
║  💾 RAM       : ${formatMemory(usedMem)} / ${formatMemory(totalMem)} (${memUsagePercent}%)
║  🖥️ Platform  : ${platform.slice(0, 35)}
║  🧠 CPU Cores : ${cpuCores}
║  🌍 Mode      : Public
║  👨‍💻 Developer : Dex Shyam Chaudhari
╠══════════════════════════════════════════╣
║  ✨ FEATURES ✨                           ║
║  • Group Management   • Antilink Protection
║  • Fun & Games        • Sticker Commands
║  • Downloader         • AI Chat
║  • And Many More!
╠══════════════════════════════════════════╣
║  💖 SPECIAL SHAYARI COLLECTION 💖         ║
╚══════════════════════════════════════════╝

✨ *Best Friend / Bestie* ✨
✩ *"Hazarō aśhantir madhyē tumi āmār ēkmātrō śhantir jāygā.. 🌟
Durottotā kilomēṭar halē'ō, dinēr śhēṣē āmār sōb hāsir kāraṇ tumi.. 😄
Ēi nil digantē ēk chilitē rōd haẏē thēkō śaratkāl, priyō Bēsṭī.."* 💙✨✈️

🎀 *Banglish Translation:* 🎀
"হাজারো অশান্তির মধ্যে তুমি আমার একমাত্র শান্তির জায়গা.. 🌟
দূরত্বটা কিলোমিটার হলেও, দিনের শেষে আমার সব হাসির কারণ তুমি.. 😄
এই নীল দিগন্তে এক চিলতে রোদ হয়ে থাকো শরৎকাল, প্রিয় বেস্টি.."* 💙✨✈️

💕 *Ekta Cute Shayari:* 💕
"Bestie tumi amaar life er chocolate syrup.. 🍫
Je kono muhurte add korle sob mishti kore deo! 🍯✨
Distance thakle'o feeling ta kachhe-i.. 🥰
Coz tumi amaar heart er permanent guest! 🏡💖"

🌸 *Banglish Translation:* 🌸
"বেস্টি তুমি আমার লাইফের চকোলেট সিরাপ.. 🍫
যে কোনো মুহূর্তে অ্যাড করলে সব মিষ্টি করে দাও! 🍯✨
দূরত্ব থাকলেও ফিলিংটা কাছেই.. 🥰
কারণ তুমি আমার হার্টের পার্মানেন্ট গেস্ট! 🏡💖"

💔 *Emotional Shayari:* 💔
"Tu..pahle aa to sahi..🥺
Ek baar..nazrein mila to sahi..😳
Main...janaze se bhi uth ke wapas aa jaunga..🥹
Bas ek baar..awaaz laga to sahi..❤️‍🩹🥀"

📝 *English Meaning:* 📝
"You.. just come first..🥺
Just once.. meet my eyes..😳
I... will rise even from the funeral and come back..🥹
Just once.. call out to me..❤️‍🩹🥀"

💡 *Bestie Care Tips* 💡
🤗 *Daily Check-in:* Proti din ekta "Ki koro?" message pathao! 💌
😂 *Fun Time:* Week a ekta funny meme/video share koro! 📹
🎉 *Surprise:* Random e ekta cute sticker/card pathao! 🎁
👯 *Memory:* Proti mashe purono photo memory share koro! 📸
💬 *Support:* Kono problem hole phone kore shono! 🤝

✨ *Friendship Mantra:* ✨
"True friendship doesn't count miles.. 📏
It counts smiles, memories & care! 😊💫
A bestie is a sister from another mother! 👭✨
Distance makes the heart grow fonder! 💞🌍"

🚀 *Type .menu to see the full command list!* 🚀
        `.trim();

        // Send the alive message
        await sock.sendMessage(chatId, {
            text: aliveText,
            contextInfo: getNewsletterInfo()
        }, { quoted: message });

    } catch (error) {
        console.error('Error in alive command:', error);
        await sock.sendMessage(chatId, {
            text: '🔥 Bot is alive and running! (Error fetching detailed stats)',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }
}

module.exports = aliveCommand;