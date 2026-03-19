const fs = require('fs');
const path = require('path');

// Emoji pool – add as many as you like!
const commandEmojis = ['⏳', '❤️‍🩹', '😮', 🥲', '😊', '🤧', '💗', '🙁'];

// Path for storing global auto‑reaction state
const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');

// Ensure data directory exists
function ensureDataDir() {
    const dir = path.dirname(USER_GROUP_DATA);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Load auto‑reaction state from file
function loadAutoReactionState() {
    try {
        ensureDataDir();
        if (fs.existsSync(USER_GROUP_DATA)) {
            const data = JSON.parse(fs.readFileSync(USER_GROUP_DATA, 'utf-8'));
            return data.autoReaction === true; // default false if missing
        }
    } catch (error) {
        console.error('❌ Error loading auto‑reaction state:', error);
    }
    return false;
}

// Save auto‑reaction state to file
function saveAutoReactionState(state) {
    try {
        ensureDataDir();
        let data = {};
        if (fs.existsSync(USER_GROUP_DATA)) {
            data = JSON.parse(fs.readFileSync(USER_GROUP_DATA, 'utf-8'));
        }
        data.autoReaction = state;
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('❌ Error saving auto‑reaction state:', error);
    }
}

// In‑memory state
let isAutoReactionEnabled = loadAutoReactionState();

// Get a random emoji from the pool
function getRandomEmoji() {
    return commandEmojis[Math.floor(Math.random() * commandEmojis.length)];
}

// Add reaction to a command message (if enabled)
async function addCommandReaction(sock, message) {
    try {
        if (!isAutoReactionEnabled || !message?.key?.id) return;
        
        const emoji = getRandomEmoji();
        await sock.sendMessage(message.key.remoteJid, {
            react: {
                text: emoji,
                key: message.key
            }
        });
    } catch (error) {
        console.error('❌ Error adding command reaction:', error);
    }
}

// Handle the .areact command (owner only)
async function handleAreactCommand(sock, chatId, message, isOwner) {
    try {
        if (!isOwner) {
            await sock.sendMessage(chatId, { 
                text: '❌ Only the bot owner can control auto‑reactions.',
                quoted: message
            });
            return;
        }

        // Extract arguments (supports both conversation and extendedTextMessage)
        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || '';
        const args = text.trim().split(/\s+/);
        const action = args[1]?.toLowerCase();

        if (action === 'on') {
            isAutoReactionEnabled = true;
            saveAutoReactionState(true);
            await sock.sendMessage(chatId, { 
                text: '✅ Auto‑reactions **enabled** globally.',
                quoted: message
            });
        } else if (action === 'off') {
            isAutoReactionEnabled = false;
            saveAutoReactionState(false);
            await sock.sendMessage(chatId, { 
                text: '✅ Auto‑reactions **disabled** globally.',
                quoted: message
            });
        } else {
            const state = isAutoReactionEnabled ? '✅ enabled' : '❌ disabled';
            await sock.sendMessage(chatId, { 
                text: `⚙️ Auto‑reactions are currently **${state}**.\n\n` +
                      '• `.areact on`  – Enable\n' +
                      '• `.areact off` – Disable',
                quoted: message
            });
        }
    } catch (error) {
        console.error('❌ Error in handleAreactCommand:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ An error occurred while processing the command.',
            quoted: message
        });
    }
}

module.exports = {
    addCommandReaction,
    handleAreactCommand
};