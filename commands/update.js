const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const settings = require('../settings');
const isOwnerOrSudo = require('../lib/isOwner');

// --- Helper: execute a command and return stdout ---
function run(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
            if (err) return reject(new Error((stderr || stdout || err.message || '').toString()));
            resolve((stdout || '').toString());
        });
    });
}

// --- Helper: get newsletter context for forwarded look ---
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

// --- Check if we are inside a Git repository ---
async function hasGitRepo() {
    const gitDir = path.join(process.cwd(), '.git');
    if (!fs.existsSync(gitDir)) return false;
    try {
        await run('git --version');
        return true;
    } catch {
        return false;
    }
}

// --- Update via Git (fetch, reset, install) ---
async function updateViaGit() {
    const oldRev = (await run('git rev-parse HEAD').catch(() => 'unknown')).trim();
    await run('git fetch --all --prune');
    const newRev = (await run('git rev-parse origin/main')).trim();
    const alreadyUpToDate = oldRev === newRev;
    const commits = alreadyUpToDate ? '' : await run(`git log --pretty=format:"%h %s (%an)" ${oldRev}..${newRev}`).catch(() => '');
    const files = alreadyUpToDate ? '' : await run(`git diff --name-status ${oldRev} ${newRev}`).catch(() => '');
    await run(`git reset --hard ${newRev}`);
    await run('git clean -fd');
    return { oldRev, newRev, alreadyUpToDate, commits, files };
}

// --- Download a file with redirect support ---
function downloadFile(url, dest, visited = new Set()) {
    return new Promise((resolve, reject) => {
        try {
            if (visited.has(url) || visited.size > 5) {
                return reject(new Error('Too many redirects'));
            }
            visited.add(url);
            const client = url.startsWith('https://') ? require('https') : require('http');
            const req = client.get(url, {
                headers: { 'User-Agent': 'dexBotmd-Updater/1.0' }
            }, res => {
                if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                    const location = res.headers.location;
                    if (!location) return reject(new Error(`HTTP ${res.statusCode} without Location`));
                    const nextUrl = new URL(location, url).toString();
                    res.resume();
                    return downloadFile(nextUrl, dest, visited).then(resolve).catch(reject);
                }
                if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
                const file = fs.createWriteStream(dest);
                res.pipe(file);
                file.on('finish', () => file.close(resolve));
                file.on('error', err => {
                    try { file.close(() => {}); } catch {}
                    fs.unlink(dest, () => reject(err));
                });
            });
            req.on('error', err => {
                fs.unlink(dest, () => reject(err));
            });
        } catch (e) {
            reject(e);
        }
    });
}

// --- Extract ZIP archive using system tools ---
async function extractZip(zipPath, outDir) {
    if (process.platform === 'win32') {
        const cmd = `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir.replace(/\\/g, '/')}' -Force"`;
        await run(cmd);
        return;
    }
    try {
        await run('command -v unzip');
        await run(`unzip -o '${zipPath}' -d '${outDir}'`);
        return;
    } catch {}
    try {
        await run('command -v 7z');
        await run(`7z x -y '${zipPath}' -o'${outDir}'`);
        return;
    } catch {}
    try {
        await run('busybox unzip -h');
        await run(`busybox unzip -o '${zipPath}' -d '${outDir}'`);
        return;
    } catch {}
    throw new Error("No system unzip tool found. Git mode is recommended.");
}

// --- Recursive copy with ignore list ---
function copyRecursive(src, dest, ignore = [], relative = '', outList = []) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
        if (ignore.includes(entry)) continue;
        const s = path.join(src, entry);
        const d = path.join(dest, entry);
        const stat = fs.lstatSync(s);
        if (stat.isDirectory()) {
            copyRecursive(s, d, ignore, path.join(relative, entry), outList);
        } else {
            fs.copyFileSync(s, d);
            if (outList) outList.push(path.join(relative, entry).replace(/\\/g, '/'));
        }
    }
}

// --- Update via ZIP download ---
async function updateViaZip(sock, chatId, message, zipOverride) {
    const zipUrl = (zipOverride || settings.updateZipUrl || process.env.UPDATE_ZIP_URL || '').trim();
    if (!zipUrl) throw new Error('No ZIP URL configured.');
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const zipPath = path.join(tmpDir, 'update.zip');
    await downloadFile(zipUrl, zipPath);
    const extractTo = path.join(tmpDir, 'update_extract');
    if (fs.existsSync(extractTo)) fs.rmSync(extractTo, { recursive: true, force: true });
    await extractZip(zipPath, extractTo);

    const root = fs.readdirSync(extractTo).map(n => path.join(extractTo, n))[0];
    const srcRoot = fs.existsSync(root) && fs.lstatSync(root).isDirectory() ? root : extractTo;

    const ignore = ['node_modules', '.git', 'session', 'tmp', 'temp', 'data', 'baileys_store.json'];
    const copied = [];
    // Preserve owner settings
    let preservedOwner = null;
    let preservedBotOwner = null;
    try {
        const currentSettings = require('../settings');
        preservedOwner = currentSettings?.ownerNumber ? String(currentSettings.ownerNumber) : null;
        preservedBotOwner = currentSettings?.botOwner ? String(currentSettings.botOwner) : null;
    } catch {}
    copyRecursive(srcRoot, process.cwd(), ignore, '', copied);
    if (preservedOwner) {
        const settingsPath = path.join(process.cwd(), 'settings.js');
        if (fs.existsSync(settingsPath)) {
            let text = fs.readFileSync(settingsPath, 'utf8');
            text = text.replace(/ownerNumber:\s*'[^']*'/, `ownerNumber: '${preservedOwner}'`);
            if (preservedBotOwner) {
                text = text.replace(/botOwner:\s*'[^']*'/, `botOwner: '${preservedBotOwner}'`);
            }
            fs.writeFileSync(settingsPath, text);
        }
    }
    // Cleanup
    try { fs.rmSync(extractTo, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(zipPath, { force: true }); } catch {}
    return { copiedFiles: copied };
}

// --- Main update command handler (NO RESTART) ---
async function updateCommand(sock, chatId, message, zipOverride) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
    
    if (!message.key.fromMe && !isOwner) {
        await sock.sendMessage(chatId, {
            text: '❌ Only bot owner or sudo can use `.update`.',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
        return;
    }

    try {
        await sock.sendMessage(chatId, {
            text: '🔄 Updating the bot, please wait…',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });

        let updateMethod = '';
        let summary = '';

        if (await hasGitRepo()) {
            updateMethod = 'git';
            const { oldRev, newRev, alreadyUpToDate, commits, files } = await updateViaGit();
            if (alreadyUpToDate) {
                summary = `✅ Already up to date (${newRev})`;
            } else {
                summary = `✅ Updated from ${oldRev.slice(0,7)} to ${newRev.slice(0,7)}`;
                await run('npm install --no-audit --no-fund');  // install new dependencies
            }
        } else {
            updateMethod = 'zip';
            const { copiedFiles } = await updateViaZip(sock, chatId, message, zipOverride);
            summary = `✅ ZIP update applied (${copiedFiles.length} files changed)`;
        }

        const version = require('../settings').version || 'unknown';
        const finalMessage = `${summary}\n\n🔁 Bot remains online.\n📦 New version: ${version}\n⚠️ Please restart the bot manually to apply all changes.`;
        await sock.sendMessage(chatId, {
            text: finalMessage,
            contextInfo: getNewsletterInfo()
        }, { quoted: message });

        console.log(`[update] ${updateMethod} update completed. Bot still running.`);
    } catch (err) {
        console.error('Update failed:', err);
        await sock.sendMessage(chatId, {
            text: `❌ Update failed:\n${String(err.message || err)}`,
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }
}

module.exports = updateCommand;