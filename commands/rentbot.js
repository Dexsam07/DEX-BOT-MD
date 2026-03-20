const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");
const NodeCache = require("node-cache");
const pino = require("pino");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const store = require('../lib/lightweight_store');

// ==================== CONFIG ====================
const MAX_CLONES_PER_USER = 3;               // max clones per user number
const CLONE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;  // 1 hour

// Database flags
const MONGO_URL = process.env.MONGO_URL;
const POSTGRES_URL = process.env.POSTGRES_URL;
const MYSQL_URL = process.env.MYSQL_URL;
const SQLITE_URL = process.env.DB_URL;
const HAS_DB = !!(MONGO_URL || POSTGRES_URL || MYSQL_URL || SQLITE_URL);

// Global clone registry
if (!global.conns) global.conns = [];              // active connections
if (!global.cloneSessions) global.cloneSessions = new Map(); // metadata

// ==================== STORAGE HELPERS ====================
const CLONES_DIR = path.join(process.cwd(), 'session', 'clones');

async function saveCloneSession(authId, data) {
    if (HAS_DB) {
        await store.saveSetting('clones', authId, data);
    } else {
        if (!fs.existsSync(CLONES_DIR)) fs.mkdirSync(CLONES_DIR, { recursive: true });
        fs.writeFileSync(path.join(CLONES_DIR, `${authId}.json`), JSON.stringify(data, null, 2));
    }
}

async function getCloneSession(authId) {
    if (HAS_DB) {
        return await store.getSetting('clones', authId);
    } else {
        const file = path.join(CLONES_DIR, `${authId}.json`);
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf-8'));
        }
        return null;
    }
}

async function deleteCloneSession(authId) {
    if (HAS_DB) {
        await store.saveSetting('clones', authId, null);
    } else {
        const file = path.join(CLONES_DIR, `${authId}.json`);
        if (fs.existsSync(file)) fs.unlinkSync(file);
    }
}

async function getAllCloneSessions() {
    if (HAS_DB) {
        const settings = await store.getSetting('clones', 'all') || {};
        return Object.keys(settings);
    } else {
        if (!fs.existsSync(CLONES_DIR)) return [];
        return fs.readdirSync(CLONES_DIR).map(f => f.replace('.json', ''));
    }
}

// ==================== CLEANUP JOB ====================
async function cleanupExpiredClones() {
    const all = await getAllCloneSessions();
    const now = Date.now();
    for (const authId of all) {
        const meta = await getCloneSession(authId);
        if (meta && (now - meta.createdAt > CLONE_EXPIRY_MS)) {
            console.log(`🧹 Cleaning expired clone: ${authId}`);
            await killClone(authId, true); // force kill and delete
        }
    }
}
setInterval(cleanupExpiredClones, CLEANUP_INTERVAL_MS);

// ==================== CLONE CONTROL ====================
async function killClone(authId, skipDelete = false) {
    // Remove from global connections
    const index = global.conns.findIndex(c => c.authId === authId);
    if (index !== -1) {
        const conn = global.conns[index];
        conn.end(new Error('Clone terminated by owner'));
        global.conns.splice(index, 1);
    }
    if (!skipDelete) await deleteCloneSession(authId);
    global.cloneSessions.delete(authId);
}

// ==================== MAIN COMMAND HANDLER ====================
module.exports = {
    command: 'rentbot',
    aliases: ['clone', 'subbot', 'clones'],
    category: 'owner',
    description: 'Manage sub‑bots (clones) – start, list, kill',
    usage: '.rentbot start 91305xxxxxxx | .rentbot list | .rentbot kill <id>',
    ownerOnly: true,

    async handler(sock, message, args, context = {}) {
        const { chatId, senderId, isOwner } = context;
        if (!isOwner) {
            return sock.sendMessage(chatId, { text: '❌ Owner only.' }, { quoted: message });
        }

        const subCmd = args[0]?.toLowerCase();
        const target = args[1];

        // ----- LIST CLONES -----
        if (subCmd === 'list' || subCmd === 'ls') {
            const all = await getAllCloneSessions();
            if (all.length === 0) {
                return sock.sendMessage(chatId, { text: '📭 No clones found.' }, { quoted: message });
            }
            let text = '*Active Clones:*\n\n';
            for (const authId of all) {
                const meta = await getCloneSession(authId);
                const status = global.conns.some(c => c.authId === authId) ? '🟢 Online' : '🔴 Offline';
                text += `• ID: \`${authId}\`\n  User: ${meta?.userNumber || '?'}\n  Status: ${status}\n  Created: ${new Date(meta?.createdAt).toLocaleString()}\n\n`;
            }
            return sock.sendMessage(chatId, { text }, { quoted: message });
        }

        // ----- KILL CLONE -----
        if (subCmd === 'kill' || subCmd === 'stop') {
            if (!target) {
                return sock.sendMessage(chatId, { text: '❌ Specify clone ID: `.rentbot kill <id>`' }, { quoted: message });
            }
            const meta = await getCloneSession(target);
            if (!meta) {
                return sock.sendMessage(chatId, { text: '❌ Clone not found.' }, { quoted: message });
            }
            await killClone(target);
            return sock.sendMessage(chatId, { text: `✅ Clone \`${target}\` terminated.` }, { quoted: message });
        }

        // ----- START CLONE -----
        if (subCmd === 'start') {
            if (!target) {
                return sock.sendMessage(chatId, { text: '❌ Provide phone number: `.rentbot start 91305xxxxxxx`' }, { quoted: message });
            }

            const userNumber = target.replace(/[^0-9]/g, '');
            if (userNumber.length < 10) {
                return sock.sendMessage(chatId, { text: '❌ Invalid number.' }, { quoted: message });
            }

            // Check user limit
            const all = await getAllCloneSessions();
            const userClones = all.filter(id => {
                const meta = global.cloneSessions.get(id) || {}; // we'll also keep in memory
                return meta.userNumber === userNumber;
            }).length;
            if (userClones >= MAX_CLONES_PER_USER) {
                return sock.sendMessage(chatId, { text: `❌ User already has ${MAX_CLONES_PER_USER} clones.` }, { quoted: message });
            }

            const authId = crypto.randomBytes(4).toString('hex');
            const sessionPath = path.join(process.cwd(), 'session', 'clones', authId);
            if (!HAS_DB && !fs.existsSync(sessionPath)) {
                fs.mkdirSync(sessionPath, { recursive: true });
            }

            // Store metadata immediately
            const meta = {
                userNumber,
                createdAt: Date.now(),
                status: 'starting',
                authId
            };
            await saveCloneSession(authId, meta);
            global.cloneSessions.set(authId, meta);

            // Start clone process (non‑blocking)
            startCloneProcess(sock, chatId, message, userNumber, authId, sessionPath).catch(err => {
                console.error(`Clone start error for ${authId}:`, err);
                sock.sendMessage(chatId, { text: `❌ Failed to start clone: ${err.message}` }, { quoted: message });
            });

            return; // async, we'll get updates via messages
        }

        // ----- DEFAULT HELP -----
        return sock.sendMessage(chatId, {
            text: `*RentBot Commands*\n\n` +
                  `• \`.rentbot start <number>\` – Start a new clone\n` +
                  `• \`.rentbot list\` – List all clones\n` +
                  `• \`.rentbot kill <id>\` – Stop a clone\n\n` +
                  `Max clones per user: ${MAX_CLONES_PER_USER}\n` +
                  `Clone expiry: ${CLONE_EXPIRY_MS / 3600000} hours`
        }, { quoted: message });
    }
};

// ==================== CLONE CREATION ====================
async function startCloneProcess(mainSock, chatId, quoteMsg, userNumber, authId, sessionPath) {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    const msgRetryCounterCache = new NodeCache();

    const conn = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.macOS("Chrome"),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        markOnlineOnConnect: true,
        msgRetryCounterCache,
        connectTimeoutMs: 120000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 30000,
        mobile: false
    });

    // Attach authId for management
    conn.authId = authId;

    if (!conn.authState.creds.registered) {
        await new Promise(resolve => setTimeout(resolve, 6000));

        try {
            let code = await conn.requestPairingCode(userNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;

            const pairingText = `*DEX-BOT-MD CLONE SYSTEM*\n\n` +
                               `ID: \`${authId}\`\n` +
                               `Code: *${code}*\n` +
                               `Storage: ${HAS_DB ? 'Database' : 'File System'}\n\n` +
                               `1. Open WhatsApp Settings\n` +
                               `2. Tap Linked Devices > Link with Phone Number\n` +
                               `3. Enter the code above.\n\n` +
                               `*Tip:* If no popup, go to 'Link with phone number' and enter manually.\n\n` +
                               `⏳ This code expires in 5 minutes.`;

            await mainSock.sendMessage(chatId, { text: pairingText }, { quoted: quoteMsg });
        } catch (err) {
            console.error("Pairing Error:", err);
            await mainSock.sendMessage(chatId, { text: "❌ Failed to request code. Try again later." }, { quoted: quoteMsg });
            await deleteCloneSession(authId);
            return;
        }
    }

    conn.ev.on('creds.update', async () => {
        await saveCreds();
        const meta = await getCloneSession(authId) || {};
        meta.status = 'active';
        await saveCloneSession(authId, meta);
        global.cloneSessions.set(authId, meta);
    });

    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            global.conns.push(conn);
            const meta = await getCloneSession(authId) || {};
            meta.status = 'online';
            meta.connectedAt = Date.now();
            await saveCloneSession(authId, meta);
            global.cloneSessions.set(authId, meta);

            await mainSock.sendMessage(chatId, {
                text: `✅ Clone \`${authId}\` is now online!\nUser: ${userNumber}`
            }, { quoted: quoteMsg });
        }

        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            if (code !== DisconnectReason.loggedOut) {
                // Auto‑reconnect
                startCloneProcess(mainSock, chatId, quoteMsg, userNumber, authId, sessionPath);
            } else {
                // Logged out – remove
                await deleteCloneSession(authId);
                const index = global.conns.indexOf(conn);
                if (index > -1) global.conns.splice(index, 1);
                global.cloneSessions.delete(authId);
                await mainSock.sendMessage(chatId, {
                    text: `🔴 Clone \`${authId}\` logged out.`
                });
            }
        }
    });

    // Attach message handler if available
    try {
        const { handleMessages } = require('../lib/messageHandler');
        conn.ev.on('messages.upsert', async (chatUpdate) => {
            await handleMessages(conn, chatUpdate, true);
        });
    } catch (e) {
        console.error("Handler linkage failed:", e.message);
    }

    return conn;
}