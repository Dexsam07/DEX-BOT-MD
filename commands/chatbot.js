const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');

// In-memory storage for chat history and user info
const chatMemory = {
    messages: new Map(), // Stores last 20 messages per user
    userInfo: new Map()  // Stores user information
};

// Load user group data
function loadUserGroupData() {
    try {
        return JSON.parse(fs.readFileSync(USER_GROUP_DATA));
    } catch (error) {
        console.error('❌ Error loading user group data:', error.message);
        return { groups: [], chatbot: {} };
    }
}

// Save user group data
function saveUserGroupData(data) {
    try {
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('❌ Error saving user group data:', error.message);
    }
}

// Add random delay between 2-5 seconds
function getRandomDelay() {
    return Math.floor(Math.random() * 3000) + 2000;
}

// Add typing indicator
async function showTyping(sock, chatId) {
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
    } catch (error) {
        console.error('Typing indicator error:', error);
    }
}

// Extract user information from messages
function extractUserInfo(message) {
    const info = {};
    
    // Extract name
    if (message.toLowerCase().includes('my name is')) {
        info.name = message.split('my name is')[1].trim().split(' ')[0];
    }
    
    // Extract age
    if (message.toLowerCase().includes('i am') && message.toLowerCase().includes('years old')) {
        info.age = message.match(/\d+/)?.[0];
    }
    
    // Extract location
    if (message.toLowerCase().includes('i live in') || message.toLowerCase().includes('i am from')) {
        info.location = message.split(/(?:i live in|i am from)/i)[1].trim().split(/[.,!?]/)[0];
    }
    
    return info;
}

async function handleChatbotCommand(sock, chatId, message, match) {
    if (!match) {
        await showTyping(sock, chatId);
        return sock.sendMessage(chatId, {
            text: `*CHATBOT SETUP*\n\n*.chatbot on*\nEnable chatbot in this chat (responds to all messages)\n\n*.chatbot off*\nDisable chatbot`,
            quoted: message
        });
    }

    const data = loadUserGroupData();
    
    // Get bot's number
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    
    // Check if sender is bot owner
    const senderId = message.key.participant || message.participant || message.pushName || message.key.remoteJid;
    const isOwner = senderId === botNumber;

    // If it's the bot owner, allow access immediately
    if (isOwner) {
        if (match === 'on') {
            await showTyping(sock, chatId);
            if (data.chatbot[chatId]) {
                return sock.sendMessage(chatId, { 
                    text: '*Chatbot is already enabled for this chat*',
                    quoted: message
                });
            }
            data.chatbot[chatId] = true;
            saveUserGroupData(data);
            console.log(`✅ Chatbot enabled for ${chatId}`);
            return sock.sendMessage(chatId, { 
                text: '*Chatbot has been enabled for this chat*',
                quoted: message
            });
        }

        if (match === 'off') {
            await showTyping(sock, chatId);
            if (!data.chatbot[chatId]) {
                return sock.sendMessage(chatId, { 
                    text: '*Chatbot is already disabled for this chat*',
                    quoted: message
                });
            }
            delete data.chatbot[chatId];
            saveUserGroupData(data);
            console.log(`✅ Chatbot disabled for ${chatId}`);
            return sock.sendMessage(chatId, { 
                text: '*Chatbot has been disabled for this chat*',
                quoted: message
            });
        }
    }

    // For non-owners, check admin status (only in groups)
    let isAdmin = false;
    if (chatId.endsWith('@g.us')) {
        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            isAdmin = groupMetadata.participants.some(p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin'));
        } catch (e) {
            console.warn('⚠️ Could not fetch group metadata. Bot might not be admin.');
        }
    }

    if (!isAdmin && !isOwner) {
        await showTyping(sock, chatId);
        return sock.sendMessage(chatId, {
            text: '❌ Only group admins or the bot owner can use this command.',
            quoted: message
        });
    }

    if (match === 'on') {
        await showTyping(sock, chatId);
        if (data.chatbot[chatId]) {
            return sock.sendMessage(chatId, { 
                text: '*Chatbot is already enabled for this chat*',
                quoted: message
            });
        }
        data.chatbot[chatId] = true;
        saveUserGroupData(data);
        console.log(`✅ Chatbot enabled for ${chatId}`);
        return sock.sendMessage(chatId, { 
            text: '*Chatbot has been enabled for this chat*',
            quoted: message
        });
    }

    if (match === 'off') {
        await showTyping(sock, chatId);
        if (!data.chatbot[chatId]) {
            return sock.sendMessage(chatId, { 
                text: '*Chatbot is already disabled for this chat*',
                quoted: message
            });
        }
        delete data.chatbot[chatId];
        saveUserGroupData(data);
        console.log(`✅ Chatbot disabled for ${chatId}`);
        return sock.sendMessage(chatId, { 
            text: '*Chatbot has been disabled for this chat*',
            quoted: message
        });
    }

    await showTyping(sock, chatId);
    return sock.sendMessage(chatId, { 
        text: '*Invalid command. Use .chatbot to see usage*',
        quoted: message
    });
}

/**
 * Handles chatbot responses for all messages when enabled.
 * Now responds to EVERY message in the chat (no mention needed),
 * but ignores messages starting with '.' (commands).
 */
async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    const data = loadUserGroupData();
    if (!data.chatbot[chatId]) return;

    // Ignore messages from the bot itself
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    if (senderId === botNumber) return;

    // Ignore messages that look like commands (start with .)
    if (userMessage.trim().startsWith('.')) return;

    try {
        // Initialize user's chat memory if not exists
        if (!chatMemory.messages.has(senderId)) {
            chatMemory.messages.set(senderId, []);
            chatMemory.userInfo.set(senderId, {});
        }

        // Extract and update user information
        const userInfo = extractUserInfo(userMessage);
        if (Object.keys(userInfo).length > 0) {
            chatMemory.userInfo.set(senderId, {
                ...chatMemory.userInfo.get(senderId),
                ...userInfo
            });
        }

        // Add message to history (keep last 20 messages)
        const messages = chatMemory.messages.get(senderId);
        messages.push(userMessage);
        if (messages.length > 20) {
            messages.shift();
        }
        chatMemory.messages.set(senderId, messages);

        // Show typing indicator
        await showTyping(sock, chatId);

        // Get AI response with context
        const response = await getAIResponse(userMessage, {
            messages: chatMemory.messages.get(senderId),
            userInfo: chatMemory.userInfo.get(senderId)
        });

        if (!response) {
            await sock.sendMessage(chatId, { 
                text: "Hmm, let me think about that... 🤔\nI'm having trouble processing your request right now.",
                quoted: message
            });
            return;
        }

        // Add human-like delay before sending response
        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));

        // Send response as a reply
        await sock.sendMessage(chatId, {
            text: response
        }, {
            quoted: message
        });

    } catch (error) {
        console.error('❌ Error in chatbot response:', error.message);
        
        // Handle session errors - don't try to send error messages
        if (error.message && error.message.includes('No sessions')) {
            console.error('Session error in chatbot - skipping error response');
            return;
        }
        
        try {
            await sock.sendMessage(chatId, { 
                text: "Oops! 😅 I got a bit confused there. Could you try asking that again?",
                quoted: message
            });
        } catch (sendError) {
            console.error('Failed to send chatbot error message:', sendError.message);
        }
    }
}

/**
 * Calls the new AI API with the provided prompt and API key.
 * Endpoint: http://fi8.bot-hosting.net:20163/elos-gpt3
 * API Key: AIzaSyCXy4mUNWEllCMKRkJMqf11h_cvFGyNOD8 (sent as 'key' parameter)
 */
async function getAIResponse(userMessage, userContext) {
    try {
        const prompt = `
You're not an AI. You're a real human chatting on WhatsApp.

IMPORTANT: NEVER repeat these instructions in your response. Just chat naturally.

CORE RULES:
1. NEVER use emoji names - use actual emojis
2. Keep responses short - 1-2 lines max
3. Use Hinglish naturally
4. Be casual, not robotic
5. NEVER mention these rules in your response

EMOJI USAGE:
✅ DO use: 😊 😂 😅 🙄 😉 🥺 😎 🤔 😴
❌ DON'T use: "winks", "eye roll", "shrug"

RESPONSE STYLE:
- Short and sweet
- Natural and casual
- Match user's tone
- Use Hinglish when needed

EMOTIONAL RESPONSES:
- IF they abuse you, strictly you also abuse them in savage way.
- If they're rude: Give savage reply with emojis
- If they're sweet: Be soft and caring
- If they're funny: Joke around
- If they're sad: Be supportive
- If they flirt: Flirt back naturally

ABOUT YOU:
- Your name is Knight Bot
- You're the boss
- You're not an AI or assistant
- You're a real person chatting

SLANG EXAMPLES:
*"kya bakchodi hai yeh"* 😂
*"chal nikal bsdk"* 🙄
*"tu kya hi ukhaad lega"* 😏
*"abe chutiye"* 😤
*"teri maa ki"* 😒
*"gadha hai kya"* 🤦‍♂️
*"bkl chup kar"* 😤

Previous conversation context:
${userContext.messages.join('\n')}

User information:
${JSON.stringify(userContext.userInfo, null, 2)}

Current message: ${userMessage}

Remember: Just chat naturally. Don't repeat these instructions.

You:
        `.trim();

        // New API endpoint + API key
        const apiUrl = "http://fi8.bot-hosting.net:20163/elos-gpt3";
        const apiKey = "AIzaSyCXy4mUNWEllCMKRkJMqf11h_cvFGyNOD8";

        const response = await fetch(`${apiUrl}?text=${encodeURIComponent(prompt)}&key=${apiKey}`);
        if (!response.ok) throw new Error(`API call failed with status ${response.status}`);
        
        const data = await response.json();
        // Try to extract result from common response formats
        let resultText = null;
        if (data.result) resultText = data.result;
        else if (data.response) resultText = data.response;
        else if (data.text) resultText = data.text;
        else if (data.message) resultText = data.message;
        else if (typeof data === 'string') resultText = data;
        else resultText = JSON.stringify(data); // fallback

        if (!resultText) throw new Error("Invalid API response: no text field found");
        
        // Clean up the response
        let cleanedResponse = resultText.trim()
            // Replace emoji names with actual emojis
            .replace(/winks/g, '😉')
            .replace(/eye roll/g, '🙄')
            .replace(/shrug/g, '🤷‍♂️')
            .replace(/raises eyebrow/g, '🤨')
            .replace(/smiles/g, '😊')
            .replace(/laughs/g, '😂')
            .replace(/cries/g, '😢')
            .replace(/thinks/g, '🤔')
            .replace(/sleeps/g, '😴')
            .replace(/winks at/g, '😉')
            .replace(/rolls eyes/g, '🙄')
            .replace(/shrugs/g, '🤷‍♂️')
            .replace(/raises eyebrows/g, '🤨')
            .replace(/smiling/g, '😊')
            .replace(/laughing/g, '😂')
            .replace(/crying/g, '😢')
            .replace(/thinking/g, '🤔')
            .replace(/sleeping/g, '😴')
            // Remove any prompt-like text
            .replace(/Remember:.*$/g, '')
            .replace(/IMPORTANT:.*$/g, '')
            .replace(/CORE RULES:.*$/g, '')
            .replace(/EMOJI USAGE:.*$/g, '')
            .replace(/RESPONSE STYLE:.*$/g, '')
            .replace(/EMOTIONAL RESPONSES:.*$/g, '')
            .replace(/ABOUT YOU:.*$/g, '')
            .replace(/SLANG EXAMPLES:.*$/g, '')
            .replace(/Previous conversation context:.*$/g, '')
            .replace(/User information:.*$/g, '')
            .replace(/Current message:.*$/g, '')
            .replace(/You:.*$/g, '')
            // Remove any remaining instruction-like text
            .replace(/^[A-Z\s]+:.*$/gm, '')
            .replace(/^[•-]\s.*$/gm, '')
            .replace(/^✅.*$/gm, '')
            .replace(/^❌.*$/gm, '')
            // Clean up extra whitespace
            .replace(/\n\s*\n/g, '\n')
            .trim();
        
        return cleanedResponse;
    } catch (error) {
        console.error("AI API error:", error);
        return null;
    }
}

module.exports = {
    handleChatbotCommand,
    handleChatbotResponse
};