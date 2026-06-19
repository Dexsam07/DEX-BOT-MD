/**
 * Dex Bot - A WhatsApp Bot
 * Copyright (c) 2025 Dex Shyam Chaudhari
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 * 
 * Credits:
 * - Baileys Library by @adiwajshing
 * - Pair Code implementation inspired by Dexsam07 & DexShyamChaudhari 
 */
require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const axios = require('axios')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep, reSize } = require('./lib/myfunc')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
const pino = require("pino")
const readline = require("readline")
const { parsePhoneNumber } = require("libphonenumber-js")
const { PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics')
const { rmSync, existsSync } = require('fs')
const { join } = require('path')

// Import lightweight store
const store = require('./lib/lightweight_store')

// Initialize store
store.readFromFile()
const settings = require('./settings')
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)

// Memory optimization
setInterval(() => {
    if (global.gc) {
        global.gc()
        console.log('🧹 Garbage collection completed')
    }
}, 60_000)

// Memory monitoring
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > 400) {
        console.log('⚠️ RAM too high (>400MB), restarting bot...')
        process.exit(1)
    }
}, 30_000)

// ✅ Owner number – sirf display ke liye, pairing ke liye nahi
let owner = JSON.parse(fs.readFileSync('./data/owner.json'))

global.botname = "Dex-Bot-md"
global.themeemoji = "•"
const customPairingCode = "DEXSHYAM";   // 8-digit custom code

// ✅ Always pairing code – QR never shows
const pairingCode = true;
const useMobile = process.argv.includes("--mobile")

// ✅ question() – creates new readline each time
const question = (text) => {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question(text, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
};

// ✅ Function to create session from SESSION_ID (base64)
function createSessionFromID(sessionId) {
    try {
        const sessionPath = './session';
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }
        const credsPath = path.join(sessionPath, 'creds.json');
        const credsData = JSON.parse(Buffer.from(sessionId, 'base64').toString('utf-8'));
        fs.writeFileSync(credsPath, JSON.stringify(credsData, null, 2));
        console.log(chalk.green('✅ Session created from SESSION_ID.'));
        return true;
    } catch (e) {
        console.log(chalk.red('❌ Failed to create session from SESSION_ID:', e.message));
        return false;
    }
}

// ✅ Validate and clean session
function validateAndCleanSession() {
    const sessionPath = './session/creds.json'
    if (fs.existsSync(sessionPath)) {
        try {
            const creds = JSON.parse(fs.readFileSync(sessionPath, 'utf8'))
            if (!creds.me || !creds.me.id) {
                throw new Error('Invalid session structure')
            }
            console.log(chalk.green('✅ Session seems valid.'))
            return true
        } catch (e) {
            console.log(chalk.yellow('⚠️ Invalid session found, deleting...'))
            try {
                rmSync('./session', { recursive: true, force: true })
                console.log(chalk.green('🗑️ Session folder removed.'))
            } catch (err) {
                console.error('Failed to delete session:', err)
            }
            return false
        }
    }
    return false
}

function sessionExistsAndValid() {
    const sessionPath = './session/creds.json'
    if (!fs.existsSync(sessionPath)) return false;
    try {
        const creds = JSON.parse(fs.readFileSync(sessionPath, 'utf8'))
        return !!(creds.me && creds.me.id);
    } catch {
        return false;
    }
}

async function startXeonBotInc() {
    try {
        // ✅ Step 1: Check for SESSION_ID in config.js or global
        let sessionId = null;
        try {
            const config = require('./config.js');
            if (config.SESSION_ID) {
                sessionId = config.SESSION_ID;
                console.log(chalk.blue('📱 Found SESSION_ID in config.js'));
            }
        } catch (e) { /* config.js not found */ }
        
        if (!sessionId && typeof global !== 'undefined' && global.SESSION_ID) {
            sessionId = global.SESSION_ID;
            console.log(chalk.blue('📱 Found SESSION_ID in global (config.js)'));
        }
        
        if (!sessionId && process.env.SESSION_ID) {
            sessionId = process.env.SESSION_ID;
            console.log(chalk.blue('📱 Found SESSION_ID in environment'));
        }

        // ✅ Step 2: If SESSION_ID exists, create session from it
        if (sessionId) {
            const created = createSessionFromID(sessionId);
            if (!created) {
                console.log(chalk.yellow('⚠️ Failed to create session from SESSION_ID. Will try other methods.'));
            }
        }

        // ✅ Step 3: Validate session (if exists)
        validateAndCleanSession()

        // ✅ Step 4: Get phone number for pairing (if needed)
        let phoneNumber = null;
        
        // Check PAIRING_NUMBER from config/global/env
        try {
            const config = require('./config.js');
            if (config.PAIRING_NUMBER) {
                phoneNumber = config.PAIRING_NUMBER;
                console.log(chalk.blue('📱 Found PAIRING_NUMBER in config.js'));
            }
        } catch (e) { /* config.js not found */ }
        
        if (!phoneNumber && typeof global !== 'undefined' && global.PAIRING_NUMBER) {
            phoneNumber = global.PAIRING_NUMBER;
            console.log(chalk.blue('📱 Found PAIRING_NUMBER in global (config.js)'));
        }
        
        if (!phoneNumber && process.env.PAIRING_NUMBER) {
            phoneNumber = process.env.PAIRING_NUMBER;
            console.log(chalk.blue('📱 Found PAIRING_NUMBER in environment'));
        }

        let { version, isLatest } = await fetchLatestBaileysVersion()
        const { state, saveCreds } = await useMultiFileAuthState(`./session`)
        const msgRetryCounterCache = new NodeCache()

        const XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: !pairingCode,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                let jid = jidNormalizedUser(key.remoteJid)
                let msg = await store.loadMessage(jid, key.id)
                return msg?.message || ""
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        })

        XeonBotInc.ev.on('creds.update', saveCreds)
        store.bind(XeonBotInc.ev)

        // Message handling
        XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
            try {
                const mek = chatUpdate.messages[0]
                if (!mek.message) return
                mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
                if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                    await handleStatus(XeonBotInc, chatUpdate);
                    return;
                }
                if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                    const isGroup = mek.key?.remoteJid?.endsWith('@g.us')
                    if (!isGroup) return
                }
                if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return

                if (XeonBotInc?.msgRetryCounterCache) {
                    XeonBotInc.msgRetryCounterCache.clear()
                }

                try {
                    await handleMessages(XeonBotInc, chatUpdate, true)
                } catch (err) {
                    console.error("Error in handleMessages:", err)
                    if (mek.key && mek.key.remoteJid) {
                        await XeonBotInc.sendMessage(mek.key.remoteJid, {
                            text: '❌ An error occurred while processing your message.',
                            contextInfo: {
                                forwardingScore: 1,
                                isForwarded: true,
                                forwardedNewsletterMessageInfo: {
                                    newsletterJid: '120363406449026172@newsletter',
                                    newsletterName: '   DEX SHYAM TECH',
                                    serverMessageId: -1
                                }
                            }
                        }).catch(console.error);
                    }
                }
            } catch (err) {
                console.error("Error in messages.upsert:", err)
            }
        })

        XeonBotInc.decodeJid = (jid) => {
            if (!jid) return jid
            if (/:\d+@/gi.test(jid)) {
                let decode = jidDecode(jid) || {}
                return decode.user && decode.server && decode.user + '@' + decode.server || jid
            } else return jid
        }

        XeonBotInc.ev.on('contacts.update', update => {
            for (let contact of update) {
                let id = XeonBotInc.decodeJid(contact.id)
                if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
            }
        })

        XeonBotInc.getName = async (jid, withoutContact = false) => {
            let id = XeonBotInc.decodeJid(jid)
            withoutContact = XeonBotInc.withoutContact || withoutContact
            let v
            if (id.endsWith("@g.us")) {
                v = store.contacts[id] || {}
                if (!(v.name || v.subject)) {
                    try {
                        v = await XeonBotInc.groupMetadata(id)
                    } catch {
                        v = {}
                    }
                }
                return v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international')
            } else {
                v = id === '0@s.whatsapp.net' ? { id, name: 'WhatsApp' } :
                    id === XeonBotInc.decodeJid(XeonBotInc.user.id) ? XeonBotInc.user :
                    (store.contacts[id] || {})
                return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international')
            }
        }

        XeonBotInc.public = true
        XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store)

        // ✅ Step 5: Pairing code logic
        if (pairingCode && !XeonBotInc.authState.creds.registered) {
            if (sessionExistsAndValid()) {
                console.log(chalk.green('✅ Valid session found, skipping pairing.'));
            } else {
                if (useMobile) throw new Error('Cannot use pairing code with mobile api')

                let phoneNumberInput = phoneNumber;
                
                // ✅ If no PAIRING_NUMBER, prompt user
                if (!phoneNumberInput) {
                    console.log(chalk.yellow('\n📱 No PAIRING_NUMBER found in config or environment.'));
                    phoneNumberInput = await question(chalk.bgBlack(chalk.greenBright(`Enter your WhatsApp number (without + or spaces): `)));
                } else {
                    console.log(chalk.blue(`📱 Using PAIRING_NUMBER: ${phoneNumberInput}`));
                }

                // Clean number – only digits
                phoneNumberInput = phoneNumberInput.replace(/[^0-9]/g, '')
                
                // Validate
                const pn = require('awesome-phonenumber');
                if (!pn('+' + phoneNumberInput).isValid()) {
                    console.log(chalk.red('❌ Invalid phone number. Please enter full international number (e.g., 917384287404) without + or spaces.'));
                    process.exit(1);
                }

                console.log(chalk.yellow(`\n⏳ Requesting pairing code for ${phoneNumberInput}...`));

                setTimeout(async () => {
                    try {
                        // ✅ Custom pairing code "DEXSHYAM" (8 digits)
                        let code = await XeonBotInc.requestPairingCode(phoneNumberInput.trim(), customPairingCode);
                        code = code?.match(/.{1,4}/g)?.join("-") || code
                        console.log(chalk.black(chalk.bgGreen(`\n📱 Your Pairing Code : `)), chalk.black(chalk.white(` ${code} `)))
                        console.log(chalk.yellow(`\n📲 Please enter this code in your WhatsApp app:\n1. Open WhatsApp\n2. Settings > Linked Devices\n3. Tap "Link a Device"\n4. Enter the code shown above\n`))
                    } catch (error) {
                        console.error('Error requesting pairing code:', error)
                        // ✅ Fallback: try without custom code
                        try {
                            console.log(chalk.yellow('⚠️ Custom code failed, trying without...'));
                            let code = await XeonBotInc.requestPairingCode(phoneNumberInput.trim());
                            code = code?.match(/.{1,4}/g)?.join("-") || code
                            console.log(chalk.black(chalk.bgGreen(`\n📱 Your Pairing Code : `)), chalk.black(chalk.white(` ${code} `)))
                            console.log(chalk.yellow(`\n📲 Please enter this code in your WhatsApp app.\n`))
                        } catch (e2) {
                            console.log(chalk.red('❌ Failed to get pairing code. Please check your number and try again.'));
                        }
                    }
                }, 3000)
            }
        }

        // Connection handling
        XeonBotInc.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect, qr } = s
            if (qr) {
                console.log(chalk.yellow('📱 QR Code generated. This should not happen in pairing mode.'))
            }
            if (connection === 'connecting') {
                console.log(chalk.yellow('🔄 Connecting to WhatsApp...'))
            }
            if (connection == "open") {
                console.log(chalk.magenta(` `))
                console.log(chalk.yellow(`🌿 Connected to => ` + JSON.stringify(XeonBotInc.user, null, 2)))

                try {
                    const botNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
                    await XeonBotInc.sendMessage(botNumber, {
                        text: `🤖 Bot Connected Successfully!\n\n⏰ Time: ${new Date().toLocaleString()}\n✅ Status: Online and Ready!`,
                        contextInfo: {
                            forwardingScore: 1,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363406449026172@newsletter',
                                newsletterName: 'DEX SHYAM TECH',
                                serverMessageId: -1
                            }
                        }
                    });
                } catch (error) {
                    console.error('Error sending connection message:', error.message)
                }

                await delay(1999)
                console.log(chalk.yellow(`\n\n                  ${chalk.bold.blue(`[ ${global.botname || 'Dex BOT'} ]`)}\n\n`))
                console.log(chalk.cyan(`< ================================================== >`))
                console.log(chalk.magenta(`\n${global.themeemoji || '•'} YT CHANNEL: MR SHYAM HACKER`))
                console.log(chalk.magenta(`${global.themeemoji || '•'} GITHUB: Dexsam07`))
                console.log(chalk.magenta(`${global.themeemoji || '•'} WA NUMBER: ${owner}`))
                console.log(chalk.magenta(`${global.themeemoji || '•'} CREDIT: MR SHYAM HACKER`))
                console.log(chalk.green(`${global.themeemoji || '•'} 🤖 Bot Connected Successfully! ✅`))
                console.log(chalk.blue(`Bot Version: ${settings.version}`))
            }
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
                const statusCode = lastDisconnect?.error?.output?.statusCode
                console.log(chalk.red(`Connection closed due to ${lastDisconnect?.error}, reconnecting ${shouldReconnect}`))
                if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                    try {
                        rmSync('./session', { recursive: true, force: true })
                        console.log(chalk.yellow('Session folder deleted. Please re-authenticate.'))
                    } catch (error) {
                        console.error('Error deleting session:', error)
                    }
                    console.log(chalk.red('Session logged out. Please re-authenticate.'))
                }
                if (shouldReconnect) {
                    console.log(chalk.yellow('Reconnecting...'))
                    await delay(5000)
                    startXeonBotInc()
                }
            }
        })

        // Anticall
        const antiCallNotified = new Set();
        XeonBotInc.ev.on('call', async (calls) => {
            try {
                const { readState: readAnticallState } = require('./commands/anticall');
                const state = readAnticallState();
                if (!state.enabled) return;
                for (const call of calls) {
                    const callerJid = call.from || call.peerJid || call.chatId;
                    if (!callerJid) continue;
                    try {
                        try {
                            if (typeof XeonBotInc.rejectCall === 'function' && call.id) {
                                await XeonBotInc.rejectCall(call.id, callerJid);
                            } else if (typeof XeonBotInc.sendCallOfferAck === 'function' && call.id) {
                                await XeonBotInc.sendCallOfferAck(call.id, callerJid, 'reject');
                            }
                        } catch {}
                        if (!antiCallNotified.has(callerJid)) {
                            antiCallNotified.add(callerJid);
                            setTimeout(() => antiCallNotified.delete(callerJid), 60000);
                            await XeonBotInc.sendMessage(callerJid, { text: '📵 Anticall is enabled. Your call was rejected and you will be blocked.' });
                        }
                    } catch {}
                    setTimeout(async () => {
                        try { await XeonBotInc.updateBlockStatus(callerJid, 'block'); } catch {}
                    }, 800);
                }
            } catch (e) {}
        });

        XeonBotInc.ev.on('group-participants.update', async (update) => {
            await handleGroupParticipantUpdate(XeonBotInc, update);
        });
        XeonBotInc.ev.on('status.update', async (status) => {
            await handleStatus(XeonBotInc, status);
        });
        XeonBotInc.ev.on('messages.reaction', async (status) => {
            await handleStatus(XeonBotInc, status);
        });

        return XeonBotInc
    } catch (error) {
        console.error('Error in startXeonBotInc:', error)
        await delay(5000)
        startXeonBotInc()
    }
}

startXeonBotInc().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
})

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err)
})

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err)
})

let file = require.resolve(__filename)
fs.watchFile(file, () => {
    fs.unwatchFile(file)
    console.log(chalk.redBright(`Update ${__filename}`))
    delete require.cache[file]
    require(file)
})
