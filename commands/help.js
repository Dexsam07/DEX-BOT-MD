const settings = require('../settings');
const fs = require('fs');
const path = require('path');

// ==================== STYLIZED MENU GENERATOR ====================
function generateHelpMessage() {
    // Categories with their commands (exactly as in original)
    const categories = [
        { name: '🌸 General Commands', commands: ['.help', '.menu', '.ping', '.alive', '.tts', '.owner', '.joke', '.quote', '.fact', '.weather', '.news', '.attp', '.lyrics', '.8ball', '.groupinfo', '.staff', '.admins', '.vv', '.trt', '.ss', '.jid', '.url'] },
        { name: '👑 Admin Commands', commands: ['.ban', '.promote', '.demote', '.mute', '.unmute', '.delete', '.del', '.kick', '.warnings', '.warn', '.antilink', '.antibadword', '.clear', '.tag', '.tagall', '.tagnotadmin', '.hidetag', '.chatbot', '.resetlink', '.antitag', '.welcome', '.goodbye', '.setgdesc', '.setgname', '.setgpp'] },
        { name: '💗 Owner Commands', commands: ['.mode', '.clearsession', '.antidelete', '.cleartmp', '.update', '.settings', '.rentbot', '.channelid', '.setpp', '.autoreact', '.autostatus', '.autostatus react', '.autotyping', '.autoread', '.anticall', '.pmblocker', '.pmblocker setmsg', '.setmention', '.mention'] },
        { name: '🎀 Image / Sticker', commands: ['.blur', '.simage', '.sticker', '.removebg', '.remini', '.crop', '.tgsticker', '.meme', '.take', '.emojimix', '.igs', '.igsc'] },
        { name: '🖤 Pies Commands', commands: ['.pies', '.china', '.indonesia', '.japan', '.korea', '.hijab'] },
        { name: '🎮 Games', commands: ['.tictactoe', '.hangman', '.guess', '.trivia', '.answer', '.truth', '.dare'] },
        { name: '🤍 AI Commands', commands: ['.gpt', '.gemini', '.imagine', '.flux', '.sora'] },
        { name: '💕 Fun Commands', commands: ['.compliment', '.insult', '.flirt', '.shayari', '.goodnight', '.roseday', '.character', '.wasted', '.ship', '.simp', '.stupid'] },
        { name: '💗 Textmaker', commands: ['.metallic', '.ice', '.snow', '.impressive', '.matrix', '.light', '.neon', '.devil', '.purple', '.thunder', '.leaves', '.1917', '.arena', '.hacker', '.sand', '.blackpink', '.glitch', '.fire'] },
        { name: '📥 Downloader', commands: ['.play', '.song', '.spotify', '.instagram', '.facebook', '.tiktok', '.video', '.ytmp4'] },
        { name: '🖤 MISC / Edits', commands: ['.heart', '.horny', '.circle', '.lgbt', '.lolice', '.its-so-stupid', '.namecard', '.oogway', '.tweet', '.ytcomment', '.comrade', '.gay', '.glass', '.jail', '.passed', '.triggered'] },
        { name: '🫶 Anime Actions', commands: ['.nom', '.poke', '.cry', '.kiss', '.pat', '.hug', '.wink', '.facepalm'] },
        { name: '💿 Github / Script', commands: ['.git', '.github', '.sc', '.script', '.repo'] }
    ];

    let totalCommands = 0;
    let message = '';

    // ───── TOP BANNER (DOUBLE LINE) ─────
    message += '╔══════════════════════════════════════════════════════════╗\n';
    message += `║            ♡  ${settings.botName?.padEnd(28) || 'DEX-MD'.padEnd(28)}  ♡            ║\n`;
    message += '╠══════════════════════════════════════════════════════════╣\n';
    message += `║  Version  ✦  ${settings.version?.padEnd(30) || '3.0.0'.padEnd(30)} ║\n`;
    message += `║  Owner    ✦  ${settings.botOwner?.padEnd(30) || 'Mr Shyam Hacker'.padEnd(30)} ║\n`;
    message += `║  YT       ✦  ${(global.ytch || 'https://youtube.com/@Dex_shyam_07').padEnd(30)} ║\n`;
    message += '╚══════════════════════════════════════════════════════════╝\n\n';

    // ───── CATEGORY BOXES (SINGLE LINE, ONE COLUMN) ─────
    for (const cat of categories) {
        totalCommands += cat.commands.length;

        // Title line with command count
        message += '┌──────────────────────────────────────────────────────┐\n';
        const title = `  ${cat.name}  (${cat.commands.length})`;
        message += '│' + title.padEnd(52) + '│\n';  // pad to 52 (box width 54 - 2 borders)
        message += '├──────────────────────────────────────────────────────┤\n';

        // List commands one per line with bullet
        for (const cmd of cat.commands) {
            const line = `  ♡  ${cmd}`;
            message += '│' + line.padEnd(52) + '│\n';
        }
        message += '└──────────────────────────────────────────────────────┘\n';
    }

    // ───── FOOTER WITH TOTAL COMMANDS & CHANNEL ─────
    message += '\n╔══════════════════════════════════════════════════════════╗\n';
    message += '║         Join our channel for updates!                    ║\n';
    message += '║              Dex-Bot-md                                   ║\n';
    message += `║           Total Commands  :  ${totalCommands}                         ║\n`;
    message += '╚══════════════════════════════════════════════════════════╝\n';

    return message;
}

// ==================== MAIN COMMAND FUNCTION ====================
async function helpCommand(sock, chatId, message) {
    const helpMessage = generateHelpMessage();

    try {
        const imagePath = path.join(__dirname, '../assets/bot_image.jpg');

        if (fs.existsSync(imagePath)) {
            const imageBuffer = fs.readFileSync(imagePath);

            await sock.sendMessage(chatId, {
                image: imageBuffer,
                caption: helpMessage,
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363406449026172@newsletter',
                        newsletterName: 'DEX SHYAM TECH',
                        serverMessageId: -1
                    }
                }
            }, { quoted: message });
        } else {
            console.error('Bot image not found at:', imagePath);
            await sock.sendMessage(chatId, {
                text: helpMessage,
                contextInfo: {
                    forwardingScore: 1,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363406449026172@newsletter',
                        newsletterName: 'DEX SHYAM TECH by Mr Shyam Hacker',
                        serverMessageId: -1
                    }
                }
            }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in help command:', error);
        await sock.sendMessage(chatId, { text: helpMessage }, { quoted: message });
    }
}

module.exports = helpCommand;