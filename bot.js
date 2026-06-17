const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const express = require('express');
const fs = require('fs');
const path = require('path');

// --- 🔒 HARDLOCKED PARSON WALA STABLE CONFIG ---
const BOT_TOKEN = '8923597334:AAF_K4fyVa_paCIqhEaoBdb1kgVkWSLON8Y'; 
const ADMIN_CHAT_ID = '7485181331'; // Master ID Locked
const CHECK_INTERVAL = 15000; // 🔥 STRICT 15-SECOND SPEED LOOP
const RENDER_URL = 'https://new-flipkart-tracker.onrender.com'; 
const DB_FILE = path.join(__dirname, 'database.json');
// ----------------------------------------

const bot = new Telegraf(BOT_TOKEN);
const activeUsers = {};
const userSessions = {}; 

// HARD ENGINE CACHE: Baar-baar file read crash protection
let approvedUsersCache = [];

// --- 📂 BULLET-PROOF DATABASE LOGIC ---
function initDatabase() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const initialData = [ADMIN_CHAT_ID.toString()];
            fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
            approvedUsersCache = initialData;
            return;
        }
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        if (!fileContent.trim()) {
            approvedUsersCache = [ADMIN_CHAT_ID.toString()];
            return;
        }
        const users = JSON.parse(fileContent);
        if (!Array.isArray(users)) {
            approvedUsersCache = [ADMIN_CHAT_ID.toString()];
            return;
        }
        if (!users.includes(ADMIN_CHAT_ID.toString())) {
            users.push(ADMIN_CHAT_ID.toString());
        }
        approvedUsersCache = users.map(String);
    } catch (e) {
        approvedUsersCache = [ADMIN_CHAT_ID.toString()];
    }
}

initDatabase();

function saveApprovedUsers(usersList) {
    try {
        const uniqueUsers = [...new Set(usersList.map(String))];
        if (!uniqueUsers.includes(ADMIN_CHAT_ID.toString())) {
            uniqueUsers.push(ADMIN_CHAT_ID.toString());
        }
        approvedUsersCache = uniqueUsers; 
        fs.writeFileSync(DB_FILE, JSON.stringify(uniqueUsers, null, 2));
    } catch (e) {}
}

function isUserApproved(userId) {
    if (!userId) return false;
    return approvedUsersCache.includes(userId.toString());
}
// --------------------------------------------

const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.status(200).send('Financial Body Engine Fixed Live!'));
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Port Binding Successful on ${PORT}`));

// 🔥 SILENT NON-STOP JHATKA SYSTEM (NO LOGS)
setInterval(() => {
    axios.get(RENDER_URL).catch(() => {}); 
}, 30000); 

// Permanent Panel Buttons Layout
const getProKeyboard = () => {
    return Markup.keyboard([
        ['🚀 Track Both', '🛵 Track Bank'],
        ['📋 List Active', '🛑 Stop All Operations']
    ]).resize();
};

// --- CALLBACK BUTTONS HANDLER ---
bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const chatId = ctx.chat.id.toString();
    const clickerId = ctx.from.id.toString();
    
    if (data.startsWith('stop_fk_')) {
        const index = parseInt(data.split('_')[2]);
        if (activeUsers[chatId] && activeUsers[chatId][index]) {
            const removedItem = activeUsers[chatId][index];
            clearInterval(removedItem.interval);
            activeUsers[chatId].splice(index, 1);
            
            await ctx.answerCbQuery(`Target [${index + 1}] Stopped! 🛑`).catch(() => {});
            await ctx.editMessageText(`🛑 <b>Target [${index + 1}] permanent saaf kar diya gaya hai!</b> Undercover agent ko is link se wapas bula liya:<br><code>${removedItem.url}</code>`, { parse_mode: 'HTML', disable_web_page_preview: true }).catch(() => {});
            return;
        }
        return ctx.answerCbQuery("⚠️ Yeh target pehle se hi band ho chuka hai.").catch(() => {});
    }

    if (data.startsWith('remusr_')) {
        if (clickerId !== ADMIN_CHAT_ID.toString()) return ctx.answerCbQuery("❌ Unauthorized!").catch(() => {});
        const targetUserId = data.split('_')[1].trim();
        
        const newList = approvedUsersCache.filter(id => id.toString() !== targetUserId.toString());
        saveApprovedUsers(newList);
        
        if (activeUsers[targetUserId]) {
            activeUsers[targetUserId].forEach(item => clearInterval(item.interval));
            delete activeUsers[targetUserId];
        }
        
        await ctx.answerCbQuery("Agent Booted! ❌").catch(() => {});
        await ctx.editMessageText(`❌ <b>Agent ${targetUserId} ka licence permanent cancel kar diya gaya hai!</b> Database clean up successful.`, { parse_mode: 'HTML' }).catch(() => {});
        bot.telegram.sendMessage(targetUserId, "🔒 <b>Your session has been terminated by Admin. Access revoked!</b>").catch(() => {});
        return;
    }

    if (clickerId !== ADMIN_CHAT_ID.toString()) return ctx.answerCbQuery("❌ Unauthorized!").catch(() => {});
    const targetUserId = data.split('_')[1].trim();
    
    if (data.startsWith('approve_')) {
        if (!approvedUsersCache.includes(targetUserId)) {
            approvedUsersCache.push(targetUserId);
            saveApprovedUsers(approvedUsersCache);
        }
        await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n✅ **Mission Status: Agent Activated Permanently!**`).catch(() => {});
        await bot.telegram.sendMessage(targetUserId, "🎉 **Mubarak ho! Admin ne aapka secret access approve kar diya hai! Neeche diye gaye control panel se operation chalu karo.**", getProKeyboard()).catch(() => {});
    } else if (data.startsWith('decline_')) {
        await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n❌ **Mission Status: Access Request Burnt!**`).catch(() => {});
    }
    await ctx.answerCbQuery().catch(() => {});
});

// --- COMMANDS MATRIX ---
bot.start((ctx) => {
    const userId = ctx.from.id.toString();
    const name = `${ctx.from.first_name || ''}`.trim();
    
    if (isUserApproved(userId)) {
        delete userSessions[userId]; 
        return ctx.reply(`🤖 *Welcome Agent ${name}!* Secret Control Panel Activated!\n\nNeeche diye gaye buttons par click karke direct use karo boss! 😎`, getProKeyboard());
    }
    
    ctx.reply(`🔒 **Access Denied!** ID: \`${userId}\` \nAdmin ke paas request bhej di gayi hai.`);
    
    bot.telegram.sendMessage(ADMIN_CHAT_ID, `🚨 **Khufiya Report: New Agent Request!**\n\nControl Room Check! Ek naya banda secret network par aane ke liye line par aaya hai.\n👤 Name: *${name}*\n🆔 ID: \`${userId}\``, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('Approve Permanent ✅', `approve_${userId}`), Markup.button.callback('Decline ❌', `decline_${userId}`)]])
    }).catch(() => {});
});

// --- KEYBOARD BUTTON TRIGGERS ---
bot.hears('🚀 Track Both', (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isUserApproved(userId)) return;
    userSessions[userId] = 'both'; 
    ctx.reply("🕵️‍♂️ **Agent Price + Bank Engine Ready!**\n\nAb seedha Flipkart ka **link paste karke send kar do** bhai!");
});

bot.hears('🛵 Track Bank', (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isUserApproved(userId)) return;
    userSessions[userId] = 'bankonly'; 
    ctx.reply("🕵️‍♂️ **Agent Only-Bank Engine Ready!**\n\nAb seedha Flipkart ka **link paste karke send kar do** bhai!");
});

bot.command('track_both', async (ctx) => { handleLegacyCommands(ctx, 'both', 'Price + Deep Bank Offers'); });
bot.command('track_bank', async (ctx) => { handleLegacyCommands(ctx, 'bankonly', 'Only Deep Bank Offers'); });

bot.command('list_track', (ctx) => { displayActiveTracks(ctx); });
bot.hears('📋 List Active', (ctx) => { displayActiveTracks(ctx); });

bot.command('stop_all', (ctx) => { killAllOperations(ctx); });
bot.hears('🛑 Stop All Operations', (ctx) => { killAllOperations(ctx); });

// --- SMART INCOMING MESSAGE INTERCEPTOR ---
bot.on('text', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isUserApproved(userId)) return;

    const textInput = ctx.message.text.trim();

    if (['🚀 Track Both', '🛵 Track Bank', '📋 List Active', '🛑 Stop All Operations'].includes(textInput)) return;

    if (userSessions[userId]) {
        const mode = userSessions[userId];
        const modeLabel = mode === 'both' ? 'Price + Deep Bank Offers' : 'Only Deep Bank Offers';
        
        const args = textInput.replace(/\n/g, ' ').split(' ').filter(arg => arg.trim() !== '');
        let fkLink = args.find(arg => arg.includes('flipkart.com/'));

        if (!fkLink) {
            return ctx.reply(`❌ **Abe saaf link bhejo Agent!**\nInput mein Flipkart ka link nahi mila. Dobara sahi se link bhejo!`, getProKeyboard());
        }

        setupCoreScraperSystem(ctx, fkLink, mode, modeLabel);
        delete userSessions[userId]; 
    } else {
        if (textInput.includes('flipkart.com/')) {
            ctx.reply(`💡 **Bhai pehle select toh karo kya track karna hai!**\nNeeche panel se \`🚀 Track Both\` ya \`🛵 Track Bank\` select karo, fir link bhejo!`, getProKeyboard());
        }
    }
});

function handleLegacyCommands(ctx, mode, modeLabel) {
    const args = ctx.message.text.replace(/\n/g, ' ').split(' ').filter(arg => arg.trim() !== '');
    let fkLink = args.find(arg => arg.includes('flipkart.com/'));
    if (!fkLink) return ctx.reply(`❌ Format Error! Commands ke sath space dekar link bhejein.`);
    setupCoreScraperSystem(ctx, fkLink, mode, modeLabel);
}

function setupCoreScraperSystem(ctx, fkLink, mode, modeLabel) {
    const chatId = ctx.chat.id.toString();
    let pid = "";
    try {
        const urlObj = new URL(fkLink);
        pid = urlObj.searchParams.get('pid');
    } catch (e) {}

    if (!pid) {
        const pidMatch = fkLink.match(/pid=([A-Z0-9]+)/i);
        if (pidMatch) pid = pidMatch[1];
    }
    if (!pid) pid = Buffer.from(fkLink).toString('base64').substring(0, 10);

    if (!activeUsers[chatId]) activeUsers[chatId] = [];
    if (activeUsers[chatId].some(item => item.id === pid)) return ctx.reply("⚠️ Abe ye target pehle se hi radar par locked hai!");

    // 🔥 PARSON WALA EXACT CORE 15-SEC SNAPSHOT RADAR LOOPS
    const intervalId = setInterval(() => { checkPageBodyFluctuations(ctx, chatId, pid, fkLink); }, CHECK_INTERVAL);

    activeUsers[chatId].push({
        id: pid,
        url: fkLink,
        mode: modeLabel,
        interval: intervalId,
        alertFired: false,
        lastBodyLength: null 
    });

    ctx.reply(`🕵️‍♂️ **Undercover Agent Active!**\n\nBhai, tu Flipkart waalon ke liye ek "secret spy" chhod raha hai. Woh log raat ko 2 baje bhi ek shabd badlenge na, toh tera bhai 15 second mein deewar kood kar tujhe khabar dega. \n\n☕ Chal ab tu aaram se chai piyo! 💣🚀`);

    checkPageBodyFluctuations(ctx, chatId, pid, fkLink);
}

function displayActiveTracks(ctx) {
    const userId = ctx.from.id.toString();
    if (!isUserApproved(userId)) return;
    const chatId = ctx.chat.id.toString();
    
    if (!activeUsers[chatId] || activeUsers[chatId].length === 0) {
        return ctx.reply("😴 Abhi koi target radar par nahi hai, sab shant hai.");
    }
    
    let msg = "📋 <b>Radar Par Locked Targets Matrix:</b>\n\n";
    let keyboardButtons = [];
    let currentRow = [];

    for (let index = 0; index < activeUsers[chatId].length; index++) {
        const item = activeUsers[chatId][index];
        msg += `🔢 <b>Target [${index + 1}]</b>\n📦 <b>ID:</b> <code>${item.id}</code>\n⚙️ <b>Mode:</b> <code>[${item.mode}]</code>\n🔗 <b>Link:</b> ${item.url}\n\n`;
        
        currentRow.push(Markup.button.callback(`Stop ${index + 1} 🛑`, `stop_fk_${index}`));
        
        if (currentRow.length === 2) {
            keyboardButtons.push(currentRow);
            currentRow = [];
        }
    }
    
    if (currentRow.length > 0) {
        keyboardButtons.push(currentRow);
    }

    ctx.reply(msg, { 
        parse_mode: 'HTML', 
        disable_web_page_preview: true,
        ...Markup.inlineKeyboard(keyboardButtons)
    }).catch(() => {});
}

function killAllOperations(ctx) {
    const userId = ctx.from.id.toString();
    if (!isUserApproved(userId)) return;
    const chatId = ctx.chat.id.toString();
    if (activeUsers[chatId] && activeUsers[chatId].length > 0) {
        activeUsers[chatId].forEach(item => clearInterval(item.interval));
        delete activeUsers[chatId];
        ctx.reply("🛑 Saare undercover agents ko headquarter wapas bula liya gya hai! Matrix cleared.");
    } else { ctx.reply("⚠️ Koyi active operation chal hi nahi rahi."); }
}

bot.command('approve', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID.toString()) {
        return ctx.reply("❌ **Access Denied!** Yeh command sirf asli Admin hi chala sakta hai. 😎");
    }
    const args = ctx.message.text.split(' ').filter(arg => arg.trim() !== '');
    if (args.length < 2) return ctx.reply("⚠️ Format: `/approve <user_id>`");
    const targetUserId = args[1].trim();
    
    if (!approvedUsersCache.includes(targetUserId)) {
        approvedUsersCache.push(targetUserId);
        saveApprovedUsers(approvedUsersCache);
        ctx.reply(`✅ Agent \`${targetUserId}\` ko permanent access de diya gaya hai!`, { parse_mode: 'Markdown' });
    } else {
        ctx.reply("⚠️ Yeh ID pehle se hi approved list mein hai.");
    }
});

bot.command('manage_users', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID.toString()) {
        return ctx.reply("❌ **Access Denied!** Yeh command sirf asli Admin hi chala sakta hai. 😎");
    }
    const rawUsers = approvedUsersCache.filter(id => id.toString() !== ADMIN_CHAT_ID.toString());
    if (rawUsers.length === 0) return ctx.reply("📋 Koi approved agent nahi hai.");
    
    let msg = "🛠️ <b>Loot Room Management Console:</b>\n\n";
    let keyboardButtons = [];
    rawUsers.forEach((u, i) => {
        msg += `${i + 1}. 🆔 User ID: <code>${u}</code>\n`;
        keyboardButtons.push([Markup.button.callback(`Remove User ${u} ❌`, `remusr_${u}`)]);
    });
    ctx.reply(msg, { parse_mode: 'HTML', ...Markup.inlineKeyboard(keyboardButtons) });
});

bot.command('list_users', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID.toString()) {
        return ctx.reply("❌ **Access Denied!** Yeh command sirf asli Admin hi chala sakta hai. 😎");
    }
    let msg = "📋 **Approved Secret Agents Database List:**\n\n";
    approvedUsersCache.forEach(u => msg += `- \`${u}\`\n`);
    ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.command('remove_user', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID.toString()) {
        return ctx.reply("❌ **Access Denied!**");
    }
    const parts = ctx.message.text.trim().split(' ');
    if (parts.length < 2) return ctx.reply("⚠️ Use: `/remove_user <user_id>`");
    const targetUserId = parts[1].trim();

    const idx = approvedUsersCache.indexOf(targetUserId);
    if (idx !== -1) {
        const newList = approvedUsersCache.filter(id => id.toString() !== targetUserId.toString());
        saveApprovedUsers(newList);
        if (activeUsers[targetUserId]) {
            activeUsers[targetUserId].forEach(item => clearInterval(item.interval));
            delete activeUsers[targetUserId];
        }
        ctx.reply(`❌ Agent \`${targetUserId}\` permanent saaf!`);
        bot.telegram.sendMessage(targetUserId, "🔒 <b>Your session has been terminated by Admin. Access revoked!</b>").catch(() => {});
    } else {
        ctx.reply("⚠️ User list mein nahi mila.");
    }
});

// --- 🔬 🔥 PARSON WALA EXACT SUPER-FAST SCRAPER ENGINE 🔥 🔬 ---
async function checkPageBodyFluctuations(ctx, chatId, pid, originalUrl) {
    if (!activeUsers[chatId]) return;
    const itemIndex = activeUsers[chatId].findIndex(item => item.id === pid);
    if (itemIndex === -1) return;

    try {
        const response = await axios.get(originalUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            timeout: 10000 
        });

        const htmlBody = String(response.data);
        const currentBodyLength = htmlBody.length; // Pure String Length Tracking

        let instance = activeUsers[chatId][itemIndex];

        // First Loop Session Sync
        if (instance.lastBodyLength === null) {
            instance.lastBodyLength = currentBodyLength;
            return;
        }

        // 🔥 HARD CHECK: Agar page ka size badla (matlab Price/Offer change ya stock status up-down hua)
        // Kuch elements dynamic badalte hain isliye length mein +/- 15 characters ka safe margin lagaya hai
        if (Math.abs(currentBodyLength - instance.lastBodyLength) > 15) {
            instance.lastBodyLength = currentBodyLength;
            instance.alertFired = true;

            // Instant Blast 15-Sec Alert Trigger!
            await bot.telegram.sendMessage(chatId, 
                `🔥 <b>LOOT ALERT: FLIPKART WAALON NE PAGE BADAL DIYA!!</b> 🔥\n\n📦 <b>Product ID:</b> <code>${pid}</code>\n⚡ <b>Status:</b> 🟢 <b>FLUCTUATION DETECTED IN 15 SECONDS!</b>\n\nBhai jaldi jaakar link check karo, price drop hua hai ya bank offer ya stock badla hai! 💻💣\n\n🔗 <b>Product Link:</b> ${originalUrl}`,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([[Markup.button.callback('Stop Tracking 🛑', `stop_fk_${itemIndex}`)]])
                }
            ).catch(() => {});

            // Auto stop after alert to avoid spam loops
            clearInterval(instance.interval);
        }

    } catch (err) {}
}

// FORCE FLUSH TO CLEAR DEPLOY CONFLICTS ON BOOT ENGINE
bot.telegram.deleteWebhook().then(() => {
    bot.launch().then(() => console.log("Parson Wala 15-Sec HTML Scraper Engine Live..."));
});
