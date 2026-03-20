const os = require('os');
const settings = require('../settings.js');

/**
 * Formats seconds into a human-readable string (e.g., "2d 3h 45m 10s").
 * @param {number} seconds - Time in seconds.
 * @returns {string} Formatted time string.
 */
function formatTime(seconds) {
    const days = Math.floor(seconds / (24 * 60 * 60));
    seconds %= (24 * 60 * 60);
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);

    let time = '';
    if (days > 0) time += `${days}d `;
    if (hours > 0) time += `${hours}h `;
    if (minutes > 0) time += `${minutes}m `;
    if (seconds > 0 || time === '') time += `${seconds}s`;
    return time.trim();
}

/**
 * Returns a contextInfo object that makes a message appear forwarded from a newsletter.
 * @returns {Object} WhatsApp contextInfo object.
 */
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

/**
 * Format memory size in bytes to a readable string (MB/GB).
 * @param {number} bytes - Memory in bytes.
 * @returns {string} Formatted memory string.
 */
function formatMemory(bytes) {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(2)} MB`;
}

/**
 * Ping command handler.
 * @param {import('@whiskeysockets/baileys').WASocket} sock - The Baileys socket.
 * @param {string} chatId - The chat ID to reply to.
 * @param {import('@whiskeysockets/baileys').proto.WebMessageInfo} message - The quoted message.
 */
async function pingCommand(sock, chatId, message) {
    try {
        // --- 1. Measure ping by sending a quick message ---
        const start = Date.now();
        await sock.sendMessage(chatId, { text: '🫣 Pong!' }, { quoted: message });
        const end = Date.now();
        const ping = Math.round((end - start) / 2); // Approximate network latency

        // --- 2. System & bot statistics ---
        const uptimeSeconds = process.uptime();
        const uptimeFormatted = formatTime(uptimeSeconds);
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(1);
        const cpus = os.cpus();
        const cpuModel = cpus[0]?.model?.trim() || 'Unknown';
        const cpuCores = cpus.length;
        const platform = `${os.platform()} ${os.release()}`;

        // --- 3. Build the beautiful response ---
        const botInfo = `
╔══════════════════════════════════════════════╗
║           🔥 DEX‑SHYAM MODE 🔥               ║
║        🤖 DEX‑BOT‑MD v${settings.version}       ║
╠══════════════════════════════════════════════╣
║  📡 PING      : ${ping} ms                    ║
║  ⏱️ UPTIME     : ${uptimeFormatted.padEnd(20)} ║
║  💾 RAM       : ${formatMemory(usedMem).padEnd(8)} / ${formatMemory(totalMem)} (${memUsagePercent}%)
║  🖥️ CPU       : ${cpuModel.substring(0, 30)}   ║
║  🧠 CORES     : ${cpuCores}                    ║
║  💻 PLATFORM  : ${platform.substring(0, 30)}   ║
╠══════════════════════════════════════════════╣
║  ᴰᵉˣ‑ᴮᵒᵗ‑ᴹᴰ ᵏᵉ ᵘᵖᵃʳ ᴬᵃʲ ᵀᵃᵏ                ║
║  ᴷᴼᴵ ᴮᴼᵀ ᴺᴬᴴᴵᴺ ᴮᴬᴺᴬʸᴬ ʜᴀɪ..              ║
║  😈🔥 𝑫𝑬𝑿‑𝑺𝑯𝒀𝑨𝑴 𝙇𝙀𝙑𝙀𝙇‑𝟬𝟳 🔥😈                ║
╚══════════════════════════════════════════════╝`.trim();

        // --- 4. Send final message with newsletter context ---
        await sock.sendMessage(chatId, {
            text: botInfo,
            contextInfo: getNewsletterInfo()   // Makes it appear forwarded from the newsletter
        }, { quoted: message });

    } catch (error) {
        console.error('❌ Error in ping command:', error);
        await sock.sendMessage(chatId, {
            text: '⚠️ Failed to get bot status. Please try again later.',
            contextInfo: getNewsletterInfo()    // Also add newsletter context on error for consistency
        }, { quoted: message });
    }
}

module.exports = pingCommand;