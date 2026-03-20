const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const { toAudio } = require('../lib/converter');

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

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

async function tryRequest(getter, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (attempt < attempts) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }
    throw lastError;
}

// EliteProTech API - Primary
async function getEliteProTechDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp3`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.downloadURL) {
        return {
            download: res.data.downloadURL,
            title: res.data.title
        };
    }
    throw new Error('EliteProTech ytdown returned no download');
}

async function getYupraDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.data?.download_url) {
        return {
            download: res.data.data.download_url,
            title: res.data.data.title,
            thumbnail: res.data.data.thumbnail
        };
    }
    throw new Error('Yupra returned no download');
}

async function getOkatsuDownloadByUrl(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.dl) {
        return {
            download: res.data.dl,
            title: res.data.title,
            thumbnail: res.data.thumb
        };
    }
    throw new Error('Okatsu ytmp3 returned no download');
}

async function songCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        if (!text) {
            await sock.sendMessage(chatId, {
                text: '🎵 *Usage:* .song <song name or YouTube link>\n\nExample: .song Believer',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        let video;
        if (text.includes('youtube.com') || text.includes('youtu.be')) {
            video = { url: text };
        } else {
            const search = await yts(text);
            if (!search || !search.videos.length) {
                await sock.sendMessage(chatId, {
                    text: '❌ Koi result nahi mila!',
                    contextInfo: getNewsletterInfo()
                }, { quoted: message });
                return;
            }
            video = search.videos[0];
        }

        // Inform user
        await sock.sendMessage(chatId, {
            image: { url: video.thumbnail },
            caption: `🎵 *Downloading:* ${video.title}\n⏱ *Duration:* ${video.timestamp}`,
            contextInfo: getNewsletterInfo()
        }, { quoted: message });

        // Try multiple APIs with fallback chain
        let audioData;
        let audioBuffer;
        let downloadSuccess = false;

        const apiMethods = [
            { name: 'EliteProTech', method: () => getEliteProTechDownloadByUrl(video.url) },
            { name: 'Yupra', method: () => getYupraDownloadByUrl(video.url) },
            { name: 'Okatsu', method: () => getOkatsuDownloadByUrl(video.url) }
        ];

        for (const apiMethod of apiMethods) {
            try {
                audioData = await apiMethod.method();
                const audioUrl = audioData.download || audioData.dl || audioData.url;

                if (!audioUrl) {
                    console.log(`${apiMethod.name} returned no download URL, trying next API...`);
                    continue;
                }

                // Try arraybuffer download
                try {
                    const audioResponse = await axios.get(audioUrl, {
                        responseType: 'arraybuffer',
                        timeout: 90000,
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity,
                        decompress: true,
                        validateStatus: s => s >= 200 && s < 400,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': '*/*',
                            'Accept-Encoding': 'identity'
                        }
                    });
                    audioBuffer = Buffer.from(audioResponse.data);
                    if (audioBuffer && audioBuffer.length > 0) {
                        downloadSuccess = true;
                        break;
                    }
                } catch (downloadErr) {
                    const statusCode = downloadErr.response?.status || downloadErr.status;
                    if (statusCode === 451) {
                        console.log(`Download blocked (451) from ${apiMethod.name}, trying next API...`);
                        continue;
                    }

                    // Try stream mode as fallback
                    try {
                        const audioResponse = await axios.get(audioUrl, {
                            responseType: 'stream',
                            timeout: 90000,
                            maxContentLength: Infinity,
                            maxBodyLength: Infinity,
                            validateStatus: s => s >= 200 && s < 400,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Accept': '*/*',
                                'Accept-Encoding': 'identity'
                            }
                        });
                        const chunks = [];
                        await new Promise((resolve, reject) => {
                            audioResponse.data.on('data', c => chunks.push(c));
                            audioResponse.data.on('end', resolve);
                            audioResponse.data.on('error', reject);
                        });
                        audioBuffer = Buffer.concat(chunks);
                        if (audioBuffer && audioBuffer.length > 0) {
                            downloadSuccess = true;
                            break;
                        }
                    } catch (streamErr) {
                        const streamStatusCode = streamErr.response?.status || streamErr.status;
                        if (streamStatusCode === 451) {
                            console.log(`Stream download blocked (451) from ${apiMethod.name}, trying next API...`);
                        } else {
                            console.log(`Stream download failed from ${apiMethod.name}:`, streamErr.message);
                        }
                        continue;
                    }
                }
            } catch (apiErr) {
                console.log(`${apiMethod.name} API failed:`, apiErr.message);
                continue;
            }
        }

        if (!downloadSuccess || !audioBuffer) {
            throw new Error('All download sources failed. The content may be unavailable or blocked.');
        }

        // Detect file format
        const firstBytes = audioBuffer.slice(0, 12);
        const asciiSignature = firstBytes.toString('ascii', 4, 8);
        let fileExtension = 'mp3';

        if (asciiSignature === 'ftyp' || firstBytes.toString('ascii', 0, 4) === 'OggS') {
            fileExtension = 'ogg';
        } else if (firstBytes.toString('ascii', 0, 3) === 'ID3' || (audioBuffer[0] === 0xFF && (audioBuffer[1] & 0xE0) === 0xE0)) {
            fileExtension = 'mp3';
        } else {
            fileExtension = 'm4a';
        }

        // Convert to MP3 if needed
        let finalBuffer = audioBuffer;
        let finalExtension = 'mp3';
        if (fileExtension !== 'mp3') {
            try {
                finalBuffer = await toAudio(audioBuffer, fileExtension);
                if (!finalBuffer || finalBuffer.length === 0) throw new Error('Conversion returned empty buffer');
            } catch (convErr) {
                throw new Error(`Conversion failed: ${convErr.message}`);
            }
        }

        // Send the audio
        await sock.sendMessage(chatId, {
            audio: finalBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${(audioData.title || video.title || 'song').replace(/[^\w\s-]/g, '')}.mp3`,
            ptt: false,
            contextInfo: getNewsletterInfo()
        }, { quoted: message });

        // Cleanup temp files (optional)
        const tempDir = path.join(__dirname, '../temp');
        if (fs.existsSync(tempDir)) {
            const now = Date.now();
            fs.readdirSync(tempDir).forEach(file => {
                const filePath = path.join(tempDir, file);
                try {
                    if (now - fs.statSync(filePath).mtimeMs > 10000) {
                        if (file.endsWith('.mp3') || file.endsWith('.m4a') || /^\d+\.(mp3|m4a)$/.test(file)) {
                            fs.unlinkSync(filePath);
                        }
                    }
                } catch {}
            });
        }

    } catch (err) {
        console.error('Song command error:', err);
        let errorMsg = '❌ Song download fail ho gaya!';
        if (err.message.includes('blocked') || err.message.includes('451')) {
            errorMsg = '❌ Content blocked (451). Ho sakta hai regional restriction ho.';
        } else if (err.message.includes('All download sources failed')) {
            errorMsg = '❌ Saare sources fail ho gaye. Song unavailable ho sakta hai.';
        } else if (err.message.includes('Conversion')) {
            errorMsg = '❌ Conversion fail. Format support nahi hai.';
        }
        await sock.sendMessage(chatId, {
            text: errorMsg,
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }
}

module.exports = songCommand;