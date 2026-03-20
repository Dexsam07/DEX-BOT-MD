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

// Helper: delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Helper: random element from array
const random = arr => arr[Math.floor(Math.random() * arr.length)];

// Helper: generate random IP
const randomIP = () => `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

// Helper: generate fake bank account
const randomAccount = () => `${Math.floor(Math.random() * 10000000000000000)}`.slice(0, 16);

// Helper: show progress bar with status messages
async function progressBar(sock, chatId, message, title, steps) {
    const barLength = 30;
    for (let i = 1; i <= steps; i++) {
        const progress = Math.round((i / steps) * barLength);
        const bar = '█'.repeat(progress) + '░'.repeat(barLength - progress);
        const status = random([
            '🤖 Processing...',
            '🔓 Decrypting...',
            '📡 Fetching data...',
            '⚙️ Compiling exploits...',
            '🧬 Injecting payload...'
        ]);
        await sock.sendMessage(chatId, {
            text: `${title}\n[${bar}] ${Math.round((i / steps) * 100)}%\n${status}`,
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
        await delay(1000 + Math.random() * 500);
    }
}

module.exports = {
    command: 'hack',
    aliases: ['fakehack', 'prankhack', 'godhack'],
    category: 'fun',
    description: 'Simulate a god-level hack sequence (fun prank)',
    usage: '.hack <target>',

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;

        // Determine target: from mention, reply, or argument
        let target = null;
        const ctxInfo = message.message?.extendedTextMessage?.contextInfo || {};
        if (ctxInfo.mentionedJid && ctxInfo.mentionedJid.length > 0) {
            target = `@${ctxInfo.mentionedJid[0].split('@')[0]}`;
        } else if (ctxInfo.participant) {
            target = `@${ctxInfo.participant.split('@')[0]}`;
        } else if (args && args[0]) {
            target = args[0];
        } else {
            target = 'unknown';
        }

        try {
            // Intro
            await sock.sendMessage(chatId, {
                text: `╔══════════════════════════════════╗
║     🧨 *GOD LEVEL HACK INITIATED* 🧨     ║
╚══════════════════════════════════╝`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            await delay(1500);

            // Phase 1: IP Tracing
            await sock.sendMessage(chatId, {
                text: `🎯 *TARGET IDENTIFIED:* ${target}\n🌐 *TRACING IP...*`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            await progressBar(sock, chatId, message, '🌍 IP Tracing', 5);
            await sock.sendMessage(chatId, {
                text: `📍 *IP ADDRESS FOUND:* ${randomIP()}\n📍 *LOCATION:* ${random(['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'USA', 'Russia', 'China'])}`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            await delay(2000);

            // Phase 2: Firewall Bypass
            await sock.sendMessage(chatId, {
                text: `🛡️ *BYPASSING FIREWALLS...*`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            await progressBar(sock, chatId, message, '🔥 Firewall Evasion', 6);
            await sock.sendMessage(chatId, {
                text: `🔓 *FIREWALLS BYPASSED USING ZERO‑DAY EXPLOIT*`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            await delay(2000);

            // Phase 3: Database Breach
            await sock.sendMessage(chatId, {
                text: `💾 *ACCESSING ENCRYPTED DATABASE...*`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            await progressBar(sock, chatId, message, '🗄️ Database Breach', 7);
            const fakeData = {
                name: target,
                phone: `+91 ${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
                email: `${target.toLowerCase().replace(/\s/g, '')}@${random(['gmail', 'yahoo', 'hotmail', 'protonmail'])}.com`,
                bank: random(['SBI', 'HDFC', 'ICICI', 'Axis', 'PNB']),
                account: randomAccount(),
                password: random(['123456', 'password123', 'qwerty', 'admin@123', 'letmein'])
            };
            await sock.sendMessage(chatId, {
                text: `📀 *DATABASE DUMP RETRIEVED:*\n\n👤 Name: ${fakeData.name}\n📞 Phone: ${fakeData.phone}\n📧 Email: ${fakeData.email}\n🏦 Bank: ${fakeData.bank}\n💳 Account: ${fakeData.account}\n🔑 Password: ${fakeData.password}`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            await delay(3000);

            // Phase 4: Device Access
            await sock.sendMessage(chatId, {
                text: `📱 *HACKING DEVICE...*`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            await progressBar(sock, chatId, message, '📲 Device Compromise', 4);
            await sock.sendMessage(chatId, {
                text: `📸 *CAMERA ACCESS GRANTED*\n🎙️ *MICROPHONE ACTIVE*\n📍 *GPS TRACKING ENABLED*`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            await delay(2000);

            // Phase 5: Social Media Takeover
            await sock.sendMessage(chatId, {
                text: `🌐 *BREACHING SOCIAL MEDIA ACCOUNTS...*`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            await progressBar(sock, chatId, message, '📱 Social Media', 5);
            const platforms = ['Instagram', 'Facebook', 'Twitter', 'Snapchat', 'WhatsApp'];
            const compromised = platforms.map(p => `✅ ${p}: hacked`).join('\n');
            await sock.sendMessage(chatId, {
                text: `🔓 *ACCOUNTS COMPROMISED:*\n${compromised}`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            await delay(2500);

            // Phase 6: Data Exfiltration
            await sock.sendMessage(chatId, {
                text: `📥 *EXFILTRATING SENSITIVE DATA...*`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            await progressBar(sock, chatId, message, '💾 Data Extraction', 6);
            await sock.sendMessage(chatId, {
                text: `📁 *FILES DOWNLOADED:*\n- personal_photos.zip\n- messages_backup.json\n- contacts.csv\n- location_history.gpx`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            await delay(2500);

            // Final: Success message with ASCII art
            const successArt = `
╔════════════════════════════════════════╗
║   💀 *HACK SUCCESSFUL* 💀               ║
║                                        ║
║   🎯 Target: ${target}                  ║
║   ⏱️ Time: ${new Date().toLocaleString()} ║
║   🔥 Status: COMPROMISED               ║
║                                        ║
║   🕸️ Backdoor installed permanently    ║
║   🕹️ Remote access granted             ║
║   🤖 Mission accomplished!             ║
╚════════════════════════════════════════╝
            `;
            await sock.sendMessage(chatId, {
                text: successArt,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            await delay(1500);
            await sock.sendMessage(chatId, {
                text: '*🕵️‍♂️ Logging off... All traces cleared.*\n\n*This was a prank! No actual hacking occurred. 😄*',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });

        } catch (error) {
            console.error('Error in god hack sequence:', error);
            await sock.sendMessage(chatId, {
                text: '❌ *Hack sequence interrupted!* Please try again later.',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        }
    }
};