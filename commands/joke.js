const axios = require('axios');
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

// List of joke APIs (fallback chain)
const jokeAPIs = [
    {
        url: 'https://icanhazdadjoke.com/',
        headers: { Accept: 'application/json' },
        extract: (data) => data.joke
    },
    {
        url: 'https://official-joke-api.appspot.com/random_joke',
        headers: {},
        extract: (data) => `${data.setup} 😄 ${data.punchline}`
    },
    {
        url: 'https://v2.jokeapi.dev/joke/Any?type=single',
        headers: {},
        extract: (data) => data.joke
    }
];

async function fetchJoke() {
    for (const api of jokeAPIs) {
        try {
            const response = await axios.get(api.url, { headers: api.headers, timeout: 5000 });
            if (response.status === 200 && response.data) {
                const joke = api.extract(response.data);
                if (joke && joke.length > 0) return joke;
            }
        } catch (err) {
            // continue to next API
            console.log(`Joke API failed: ${api.url}`);
        }
    }
    return null;
}

module.exports = {
    command: 'joke',
    aliases: ['dadjoke', 'funny'],
    category: 'fun',
    description: 'Get a random dad joke',
    usage: '.joke',

    async handler(sock, message, args, context = {}) {
        const chatId = context.chatId || message.key.remoteJid;

        try {
            const joke = await fetchJoke();
            if (joke) {
                await sock.sendMessage(chatId, {
                    text: `😂 *Here's a joke for you:* 😂\n\n${joke}`,
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
            } else {
                // Local fallback jokes
                const fallbackJokes = [
                    "Why don't scientists trust atoms? Because they make up everything! 😄",
                    "What do you call a fake noodle? An impasta! 🍝",
                    "Why did the scarecrow win an award? Because he was outstanding in his field! 🌾",
                    "What do you call a bear with no teeth? A gummy bear! 🐻",
                    "Why don't eggs tell jokes? They'd crack each other up! 🥚"
                ];
                const randomJoke = fallbackJokes[Math.floor(Math.random() * fallbackJokes.length)];
                await sock.sendMessage(chatId, {
                    text: `😂 *Kuch gadbad ho gayi, lekin ye lo:* 😂\n\n${randomJoke}`,
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
            }
        } catch (error) {
            console.error('Joke command error:', error);
            await sock.sendMessage(chatId, {
                text: '❌ *Joke laane mein problem hui! Thodi der baad try karo.*',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        }
    }
};