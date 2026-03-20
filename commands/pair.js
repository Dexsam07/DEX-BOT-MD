const axios = require('axios');
const { sleep } = require('../lib/myfunc');
const settings = require('../settings'); // assuming you have a settings file

// Configuration – you can move this to settings.js
const PAIR_API_URL = settings.pairApiUrl || 'https://dex-bot-md-pair.zone.id/pair';
const OWNER_ONLY = true; // set to false if you want anyone to use it

async function pairCommand(sock, chatId, message, q, isOwner) {
    try {
        // ----- Owner check -----
        if (OWNER_ONLY && !isOwner) {
            return await sock.sendMessage(chatId, {
                text: '❌ Only the bot owner can use this command.',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        }

        // ----- Input validation -----
        if (!q || q.trim() === '') {
            return await sock.sendMessage(chatId, {
                text: '❌ Please provide at least one WhatsApp number.\n\nExample: `.pair 91702395XXXX` or `.pair 919876543210, 918765432109`',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        }

        // Parse and clean numbers
        const numbers = q.split(',')
            .map(v => v.replace(/[^0-9]/g, ''))
            .filter(v => v.length >= 10 && v.length <= 15); // international format

        if (numbers.length === 0) {
            return await sock.sendMessage(chatId, {
                text: '❌ No valid numbers found. Use international format (e.g., 91702395XXXX).',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        }

        // Limit to 3 numbers per command to avoid abuse
        if (numbers.length > 3) {
            return await sock.sendMessage(chatId, {
                text: '⚠️ You can only request pairing for up to 3 numbers at once.',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        }

        // ----- Process each number -----
        let results = [];
        for (const number of numbers) {
            const jid = number + '@s.whatsapp.net';

            // Check if number is on WhatsApp
            const [exists] = await sock.onWhatsApp(jid);
            if (!exists?.exists) {
                results.push(`❌ ${number}: Not registered on WhatsApp.`);
                continue;
            }

            // Notify user we're working on it
            await sock.sendMessage(chatId, {
                text: `⏳ Requesting pairing code for ${number}...`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });

            // Call pairing API with retry logic
            let code = null;
            let attempts = 0;
            const maxAttempts = 2;

            while (attempts < maxAttempts && !code) {
                attempts++;
                try {
                    const response = await axios.get(`${PAIR_API_URL}?number=${number}`, {
                        timeout: 10000, // 10 seconds timeout
                        headers: {
                            'User-Agent': 'DEX-MD/3.0 (WhatsApp Bot)'
                        }
                    });

                    const data = response.data;
                    if (data && data.code && data.code !== 'Service Unavailable') {
                        code = data.code;
                    } else if (data && data.error) {
                        throw new Error(data.error);
                    } else {
                        throw new Error('Invalid response from server');
                    }
                } catch (err) {
                    console.error(`API attempt ${attempts} failed for ${number}:`, err.message);
                    if (attempts === maxAttempts) {
                        results.push(`❌ ${number}: Failed after ${maxAttempts} attempts.`);
                    } else {
                        await sleep(2000); // wait before retry
                    }
                }
            }

            if (code) {
                // Wait a bit before sending code (human-like)
                await sleep(3000);
                results.push(`✅ ${number}: Pairing code = \`${code}\``);
            }
        }

        // ----- Send final summary -----
        if (results.length > 0) {
            const summary = results.join('\n');
            await sock.sendMessage(chatId, {
                text: `*Pairing Results*\n\n${summary}\n\n📌 The code has also been sent to the target number via WhatsApp.`,
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                text: '❌ No pairing codes could be generated. Please try again later.',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
        }

    } catch (error) {
        console.error('❌ Pair command error:', error);
        await sock.sendMessage(chatId, {
            text: '❌ An unexpected error occurred. Please try again later.',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }
}

// Helper to keep newsletter context DRY
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

module.exports = pairCommand;