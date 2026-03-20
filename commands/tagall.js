const isAdmin = require('../lib/isAdmin');
const settings = require('../settings'); // for optional custom message

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

async function tagAllCommand(sock, chatId, senderId, message) {
    try {
        // Check admin status
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, {
                text: '❌ Please make the bot an admin first.',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, {
                text: '⛔ Only group admins can use the .tagall command.',
                contextInfo: getNewsletterInfo()
            }, { quoted: message });
            return;
        }

        // Get group participants
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;

        if (!participants || participants.length === 0) {
            await sock.sendMessage(chatId, {
                text: '⚠️ No participants found in the group.',
                contextInfo: getNewsletterInfo()
            });
            return;
        }

        // Prepare the message header (customizable via settings)
        const header = settings.tagAllMessage || '🔊 *Hello Everyone:*\n\n';
        const memberCount = participants.length;
        const headerWithCount = `${header}📊 *Total members:* ${memberCount}\n\n`;

        // Build the list of mentions (each on a new line)
        let lines = participants.map(p => `@${p.id.split('@')[0]}`);
        // Also prepare the mentions array
        const mentions = participants.map(p => p.id);

        // WhatsApp text limit ~4096 characters. We'll split into chunks of ~2000 chars to be safe.
        const maxChunkLength = 2000;
        let currentChunk = headerWithCount;
        let currentLength = currentChunk.length;
        let chunks = [];

        for (const line of lines) {
            const lineWithNewline = line + '\n';
            if (currentLength + lineWithNewline.length > maxChunkLength) {
                chunks.push({ text: currentChunk, mentions: [] }); // mentions will be added later
                currentChunk = lineWithNewline;
                currentLength = lineWithNewline.length;
            } else {
                currentChunk += lineWithNewline;
                currentLength += lineWithNewline.length;
            }
        }
        if (currentChunk) {
            chunks.push({ text: currentChunk, mentions: [] });
        }

        // Now assign mentions to each chunk (only the users mentioned in that chunk)
        // Since each line corresponds to a participant, we need to map mentions per chunk.
        // We'll do it by iterating over participants again and checking which chunk each line falls into.
        let chunkIndex = 0;
        let chunkOffset = 0; // number of lines already assigned to previous chunks
        for (let i = 0; i < participants.length; i++) {
            const participant = participants[i];
            const line = lines[i];
            // Determine which chunk this line belongs to
            // We'll keep track of chunk boundaries
            while (chunkIndex < chunks.length) {
                // We need to count how many lines are in each chunk
                // But we don't have line count. Instead, we can simulate by building the chunks again with the same logic,
                // but that's messy. Simpler: after building chunks, we can parse each chunk's text to count how many @ mentions it contains.
                // But that may be unreliable if the text contains other @ symbols. So a cleaner way: store the lines per chunk during construction.
                // We'll reconstruct using the same loop but store lines per chunk.
                // Let's redo the chunking with storing lines per chunk.
            }
        }

        // Simpler: Since we built chunks with the same logic, we can just collect mentions per chunk by
        // iterating over participants and seeing which chunk the line belongs to. We'll do that now.
        // Reset chunk index and offset.
        chunkIndex = 0;
        let linesInCurrentChunk = 0;
        for (let i = 0; i < participants.length; i++) {
            const line = lines[i];
            // Check if adding this line would overflow the chunk? We don't have length info easily.
            // Instead, we'll just use the same logic as before to assign lines to chunks, but store mentions.
            // We'll rebuild chunks from scratch with proper line storage.
        }

        // To avoid complexity, we can simply send the whole text in one message if it's not too long,
        // otherwise we split the participants list into batches and send separate messages.
        // But splitting by text length is more accurate.
        // Let's do the clean approach: rebuild chunks with line storage.

        const chunksWithLines = [];
        let chunkLines = [];
        let chunkText = headerWithCount;
        let chunkLength = chunkText.length;

        for (let i = 0; i < participants.length; i++) {
            const line = lines[i];
            const lineWithNewline = line + '\n';
            if (chunkLength + lineWithNewline.length > maxChunkLength) {
                // Finalize current chunk
                chunksWithLines.push({ text: chunkText, lines: chunkLines });
                // Start new chunk
                chunkText = lineWithNewline;
                chunkLength = lineWithNewline.length;
                chunkLines = [i];
            } else {
                chunkText += lineWithNewline;
                chunkLength += lineWithNewline.length;
                chunkLines.push(i);
            }
        }
        if (chunkText) {
            chunksWithLines.push({ text: chunkText, lines: chunkLines });
        }

        // Now send each chunk with its specific mentions
        for (const chunk of chunksWithLines) {
            const chunkMentions = chunk.lines.map(idx => participants[idx].id);
            await sock.sendMessage(chatId, {
                text: chunk.text,
                mentions: chunkMentions,
                contextInfo: getNewsletterInfo()
            });
            // Optional: tiny delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }

    } catch (error) {
        console.error('Error in tagall command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to tag all members. Please try again later.',
            contextInfo: getNewsletterInfo()
        }, { quoted: message });
    }
}

module.exports = tagAllCommand;