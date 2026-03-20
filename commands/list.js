const settings = require('../settings');
const commandHandler = require('../lib/commandHandler');
const path = require('path');
const fs = require('fs');

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

// Format current time according to settings.timeZone
function formatTime() {
    const now = new Date();
    const options = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: settings.timeZone || 'UTC'
    };
    return now.toLocaleTimeString('en-US', options);
}

// Define menu styles (0-6)
const menuStyles = [
    // Style 0 – Classic with double lines
    {
        render({ title, info, categories, prefix }) {
            let t = `╭━━━━『 *${title}* 』━━━━⬣\n`;
            t += `┃ ✨ *Bot:* ${info.bot}\n`;
            t += `┃ 🔧 *Prefix:* ${info.prefix}\n`;
            t += `┃ 📦 *Plugins:* ${info.total}\n`;
            t += `┃ 💎 *Version:* ${info.version}\n`;
            t += `┃ ⏰ *Time:* ${info.time}\n`;
            for (const [cat, cmds] of categories) {
                t += `┃━━━ *${cat.toUpperCase()}* ━━━\n`;
                for (const c of cmds)
                    t += `┃ ➤ ${prefix}${c}\n`;
            }
            t += `╰━━━━━━━━━━━━━━━━━━━⬣`;
            return t;
        }
    },
    // Style 1 – Clean with circles
    {
        render({ title, info, categories, prefix }) {
            let t = `◈╭─❍「 *${title}* 」❍\n`;
            t += `◈├• 🌟 *Bot:* ${info.bot}\n`;
            t += `◈├• ⚙️ *Prefix:* ${info.prefix}\n`;
            t += `◈├• 🍫 *Plugins:* ${info.total}\n`;
            t += `◈├• 💎 *Version:* ${info.version}\n`;
            t += `◈├• ⏰ *Time:* ${info.time}\n`;
            for (const [cat, cmds] of categories) {
                t += `◈├─❍「 *${cat.toUpperCase()}* 」❍\n`;
                for (const c of cmds)
                    t += `◈├• ${prefix}${c}\n`;
            }
            t += `◈╰──★─☆──♪♪─❍`;
            return t;
        }
    },
    // Style 2 – Simple boxes
    {
        render({ title, info, categories, prefix }) {
            let t = `┏━━━━ *${title}* ━━━━┓\n`;
            t += `┃• *Bot:* ${info.bot}\n`;
            t += `┃• *Prefixes:* ${info.prefix}\n`;
            t += `┃• *Plugins:* ${info.total}\n`;
            t += `┃• *Version:* ${info.version}\n`;
            t += `┃• *Time:* ${info.time}\n`;
            for (const [cat, cmds] of categories) {
                t += `┃━━━━ *${cat.toUpperCase()}* ━━◆\n`;
                for (const c of cmds)
                    t += `┃ ▸ ${prefix}${c}\n`;
            }
            t += `┗━━━━━━━━━━━━━━━┛`;
            return t;
        }
    },
    // Style 3 – Stars and lines
    {
        render({ title, info, categories, prefix }) {
            let t = `✦═══ *${title}* ═══✦\n`;
            t += `║➩ *Bot:* ${info.bot}\n`;
            t += `║➩ *Prefixes:* ${info.prefix}\n`;
            t += `║➩ *Plugins:* ${info.total}\n`;
            t += `║➩ *Version:* ${info.version}\n`;
            t += `║➩ *Time:* ${info.time}\n`;
            for (const [cat, cmds] of categories) {
                t += `║══ *${cat.toUpperCase()}* ══✧\n`;
                for (const c of cmds)
                    t += `║ ✦ ${prefix}${c}\n`;
            }
            t += `✦══════════════✦`;
            return t;
        }
    },
    // Style 4 – Flower style
    {
        render({ title, info, categories, prefix }) {
            let t = `❀━━━ *${title}* ━━━❀\n`;
            t += `┃☞ *Bot:* ${info.bot}\n`;
            t += `┃☞ *Prefixes:* ${info.prefix}\n`;
            t += `┃☞ *Plugins:* ${info.total}\n`;
            t += `┃☞ *Version:* ${info.version}\n`;
            t += `┃☞ *Time:* ${info.time}\n`;
            for (const [cat, cmds] of categories) {
                t += `┃━━━〔 *${cat.toUpperCase()}* 〕━❀\n`;
                for (const c of cmds)
                    t += `┃☞ ${prefix}${c}\n`;
            }
            t += `❀━━━━━━━━━━━━━━❀`;
            return t;
        }
    },
    // Style 5 – Diamond style
    {
        render({ title, info, categories, prefix }) {
            let t = `◆━━━ *${title}* ━━━◆\n`;
            t += `┃ ¤ *Bot:* ${info.bot}\n`;
            t += `┃ ¤ *Prefixes:* ${info.prefix}\n`;
            t += `┃ ¤ *Plugins:* ${info.total}\n`;
            t += `┃ ¤ *Version:* ${info.version}\n`;
            t += `┃ ¤ *Time:* ${info.time}\n`;
            for (const [cat, cmds] of categories) {
                t += `┃━━ *${cat.toUpperCase()}* ━━◆◆\n`;
                for (const c of cmds)
                    t += `┃ ¤ ${prefix}${c}\n`;
            }
            t += `◆━━━━━━━━━━━━━━━━◆`;
            return t;
        }
    },
    // Style 6 – Minimalist
    {
        render({ title, info, categories, prefix }) {
            let t = `╭───⬣ *${title}* ──⬣\n`;
            t += ` | ● *Bot:* ${info.bot}\n`;
            t += ` | ● *Prefixes:* ${info.prefix}\n`;
            t += ` | ● *Plugins:* ${info.total}\n`;
            t += ` | ● *Version:* ${info.version}\n`;
            t += ` | ● *Time:* ${info.time}\n`;
            for (const [cat, cmds] of categories) {
                t += ` |───⬣ *${cat.toUpperCase()}* ──⬣\n`;
                for (const c of cmds)
                    t += ` | ● ${prefix}${c}\n`;
            }
            t += `╰──────────⬣`;
            return t;
        }
    }
];

// Helper: pick random element from array
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

module.exports = {
    command: 'menu',
    aliases: ['help', 'commands', 'h', 'list'],
    category: 'general',
    description: 'Show all commands (supports optional style number 0-6)',
    usage: '.menu [style]',

    async handler(sock, message, args, context) {
        const { chatId, channelInfo } = context;
        const prefix = settings.prefixes[0];
        const imagePath = path.join(__dirname, '../assets/bot_image.jpg');

        // If user provided a style number, validate and use it
        let selectedStyle = null;
        if (args.length && /^\d+$/.test(args[0])) {
            const styleIndex = parseInt(args[0]);
            if (styleIndex >= 0 && styleIndex < menuStyles.length) {
                selectedStyle = menuStyles[styleIndex];
            } else {
                await sock.sendMessage(chatId, {
                    text: `⚠️ Style number must be between 0 and ${menuStyles.length - 1}. Using random style.`,
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
            }
        }

        // If user provided a command name, show detailed info
        if (args.length && !/^\d+$/.test(args[0])) {
            const searchTerm = args[0].toLowerCase();

            let cmd = commandHandler.commands.get(searchTerm);
            if (!cmd && commandHandler.aliases.has(searchTerm)) {
                const mainCommand = commandHandler.aliases.get(searchTerm);
                cmd = commandHandler.commands.get(mainCommand);
            }

            if (!cmd) {
                return sock.sendMessage(chatId, {
                    text: `❌ Command "${args[0]}" not found.\n\nUse ${prefix}menu to see all commands.`,
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
            }

            const text =
                `╭━━━━━━━━━━━━━━⬣
┃ 📌 *COMMAND INFO*
┃
┃ ⚡ *Command:* ${prefix}${cmd.command}
┃ 📝 *Desc:* ${cmd.description || 'No description'}
┃ 📖 *Usage:* ${cmd.usage || `${prefix}${cmd.command}`}
┃ 🏷️ *Category:* ${cmd.category || 'misc'}
┃ 🔖 *Aliases:* ${cmd.aliases?.length ? cmd.aliases.map(a => prefix + a).join(', ') : 'None'}
┃
╰━━━━━━━━━━━━━━⬣`;

            if (fs.existsSync(imagePath)) {
                return sock.sendMessage(chatId, {
                    image: { url: imagePath },
                    caption: text,
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
            }

            return sock.sendMessage(chatId, { text, contextInfo: getNewsletterInfo() }, { quoted: message });
        }

        // No args: show full menu with random (or selected) style
        const style = selectedStyle || pick(menuStyles);

        const text = style.render({
            title: settings.botName || 'DEX BOT',
            prefix,
            info: {
                bot: settings.botName,
                prefix: settings.prefixes.join(', '),
                total: commandHandler.commands.size,
                version: settings.version || '5.0.0',
                time: formatTime()
            },
            categories: commandHandler.categories
        });

        // Send with image if exists
        if (fs.existsSync(imagePath)) {
            await sock.sendMessage(chatId, {
                image: { url: imagePath },
                caption: text,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                text,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        }
    }
};