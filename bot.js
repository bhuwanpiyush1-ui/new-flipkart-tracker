const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const express = require('express');
const fs = require('fs'); // 🔥 Filesystem Core (Permanent Storage ke liye)
const path = require('path');

// --- CONFIGURATION ---
const BOT_TOKEN = '8923597334:AAEm75cG0EbDinDksLc2Dki28EYfjbfS_eQ'; 
const ADMIN_CHAT_ID = '7485181331'; 
const CHECK_INTERVAL = 15000; 
const RENDER_URL = 'https://instamart-tracker-bot.onrender.com/'; 
const DB_FILE = path.join(__dirname, 'database.json');
// ---------------------

const bot = new Telegraf(BOT_TOKEN);
const activeUsers = {};

// --- 📂 PERMANENT DATABASE STORAGE LOGIC ---
function loadApprovedUsers() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            // Agar file nahi hai to Admin ID ke sath fresh banao
            const initialData = [ADMIN_CHAT_ID.toString()];
            fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
            return initialData;
        }
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        const users = JSON.parse(fileContent);
        if (!users.includes(ADMIN_CHAT_ID.toString())) {
            users.push(ADMIN_CHAT_ID.toString());
        }
        return users.map(String);
    } catch (e) {
        console.log("⚠️ DB Load Error, falling back:", e.message);
        return [ADMIN_CHAT_ID.toString()];
    }
}

function saveApprovedUsers(usersList) {
    try {
        const uniqueUsers = [...new Set(usersList.map(String))];
        fs.writeFileSync(DB_FILE, JSON.stringify(uniqueUsers, null, 2));
    } catch (e) {
        console.log("⚠️ DB Save Error:", e.message);
    }
}

function isUserApproved(userId) {
    if (!userId) return false;
    const currentList = loadApprovedUsers();
    return currentList.includes(userId.toString());
}
// --------------------------------------------

const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.status(200).send('Permanent Storage Engine Live!'));
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Master Engine Port Binding Successful on ${PORT}`));

// 🔥 ALIVE JHATKA SYSTEM (Bypasses Render Sleep State)
setInterval(() => {
    axios.get(RENDER_URL).catch(() => {}); 
}, 30000); 

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
            await ctx.answerCbQuery("Tracking band kar di gayi hai! 🛑").catch(() => {});
            return ctx.reply(`🛑 Stopped tracking for:\n${removedItem.url}`, { disable_web_page_preview: true });
        }
        return ctx.answerCbQuery("⚠️ Already stopped.").catch(() => {});
    }

    if (clickerId !== ADMIN_CHAT_ID.toString()) {
        return ctx.answerCbQuery("❌ Unauthorized! Sirf Admin click kar sakta hai.").catch(() => {});
    }
    
    const targetUserId = data.split('_')[1].trim();
    let currentList = loadApprovedUsers();
    
    if (data.startsWith('approve_')) {
        if (!currentList.includes(targetUserId)) {
            currentList.push(targetUserId);
            saveApprovedUsers(currentList); // Permanent save in file
        }
        await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n✅ **Status: Approved Permanently!**`).catch(() => {});
        
        await bot.telegram.sendMessage(targetUserId, "🎉 **Mubarak ho! Admin ne aapka access approve kar diya hai!**\n\nAb aapka access permanent locked hai.\n👉 Link track karne ke liye format:\n`/start_track <Flipkart_URL>`", { parse_mode: 'Markdown' }).catch(() => {});
    } else if (data.startsWith('decline_')) {
        await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n❌ **Status: Declined!**`).catch(() => {});
        await bot.telegram.sendMessage(targetUserId, "❌ Sorry! Admin ne aapka access request decline kar diya hai.").catch(() => {});
    }
    await ctx.answerCbQuery().catch(() => {});
});

// --- COMMAND: START (REQUEST SYSTEM) ---
bot.start((ctx) => {
    const userId = ctx.from.id.toString();
    const name = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() || 'No Name';
    
    if (isUserApproved(userId)) {
        return ctx.reply(`🤖 *Welcome ${ctx.from.first_name || ''}!* Master Control Tracker Active!\n\n🔹 **User Commands:**\n🚀 \`/start_track <Flipkart_URL>\` — Naya link lagaen\n📋 \`/list_track\` — Chal rahe active links dekhein\n🛑 \`/stop_all\` — Saari tracking band karein\n\n👑 **Admin Special Commands:**\n✅ \`/approve <User_ID>\` — User permanent allowed karein\n📋 \`/list_users\` — Approved users ki list\n❌ \`/remove_user <User_ID>\` — User block karein`, { parse_mode: 'Markdown' });
    }
    
    ctx.reply(`🔒 **Access Denied!**\n\nAap abhi approved nahi hain.\nAapki Telegram ID: \`${userId}\`\n\nAdmin ke paas request bhej di gayi hai, kripya wait karein...`);
    
    bot.telegram.sendMessage(ADMIN_CHAT_ID, 
        `🚨 **New Access Request!**\n\n👤 Name: ${name}\n🆔 ID: \`${userId}\`\n\n👉 Approve karne ke liye niche click karein ya type karein:\n\`/approve ${userId}\``,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback('Approve ✅', `approve_${userId}`), 
                    Markup.button.callback('Decline ❌', `decline_${userId}`)
                ]
            ])
        }
    ).catch(() => {});
});

// --- COMMAND: APPROVE (ADMIN ONLY) ---
bot.command('approve', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID.toString()) return ctx.reply("❌ Sirf Admin hi approve kar sakta hai!");
    const args = ctx.message.text.split(' ').filter(arg => arg.trim() !== '');
    if (args.length < 2) return ctx.reply("⚠️ Format: `/approve <User_ID>`");
    
    const targetUserId = args[1].trim();
    let currentList = loadApprovedUsers();

    if (!currentList.includes(targetUserId)) {
        currentList.push(targetUserId);
        saveApprovedUsers(currentList); // Save permanently to disk
        ctx.reply(`✅ User ID \`${targetUserId}\` ko permanent approve kar diya gaya.`);
        
        bot.telegram.sendMessage(targetUserId, "🎉 **Mubarak ho! Admin ne aapka access approve kar diya hai!**\n\nAb aap bot ka use kar sakte hain.\n👉 Link track karne ke liye format:\n`/start_track <Flipkart_URL>`", { parse_mode: 'Markdown' }).catch(() => {});
    } else {
        ctx.reply("⚠️ Yeh user pehle se hi approved hai.");
    }
});

// --- COMMAND: LIST USERS (ADMIN ONLY) ---
bot.command('list_users', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID.toString()) return ctx.reply("❌ Sirf Admin hi approved users dekh sakta hai!");
    const currentList = loadApprovedUsers();
    
    if (currentList.length === 0) return ctx.reply("📋 Koyi approved user nahi hai.");
    
    let msg = "📋 **Approved Users (Permanent Database):**\n\n";
    currentList.forEach((user, index) => {
        msg += `${index + 1}. ID: \`${user}\` ${user === ADMIN_CHAT_ID ? '(👑 Admin)' : ''}\n`;
    });
    ctx.reply(msg, { parse_mode: 'Markdown' });
});

// --- COMMAND: REMOVE USER (ADMIN ONLY) ---
bot.command('remove_user', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID.toString()) return ctx.reply("❌ Sirf Admin hi user remove kar sakta hai!");
    const args = ctx.message.text.split(' ').filter(arg => arg.trim() !== '');
    if (args.length < 2) return ctx.reply("⚠️ Format: `/remove_user <User_ID>`");
    
    const targetUserId = args[1].trim();
    if (targetUserId === ADMIN_CHAT_ID.toString()) return ctx.reply("❌ Bhai khud ko remove nahi kar sakte!");
    
    let currentList = loadApprovedUsers();
    const index = currentList.indexOf(targetUserId);

    if (index !== -1) {
        currentList.splice(index, 1);
        saveApprovedUsers(currentList); // Update file system data permanently
        ctx.reply(`❌ User ID \`${targetUserId}\` ka access permanent delete kar diya gaya.`);
        
        bot.telegram.sendMessage(targetUserId, "🔒 **Aapka access admin dwara remove kar diya gaya hai.**").catch(() => {});
        
        if (activeUsers[targetUserId]) {
            activeUsers[targetUserId].forEach(item => clearInterval(item.interval));
            delete activeUsers[targetUserId];
        }
    } else {
        ctx.reply("⚠️ Yeh ID database list mein nahi mili.");
    }
});

// --- COMMAND: START TRACK (USER & ADMIN) ---
bot.command('start_track', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isUserApproved(userId)) return ctx.reply("❌ Access Denied! Aap approved nahi hain.");
    
    const chatId = ctx.chat.id.toString();
    const args = ctx.message.text.replace(/\n/g, ' ').split(' ').filter(arg => arg.trim() !== '');
    
    let fkLink = args.find(arg => arg.includes('flipkart.com/'));
    if (!fkLink) return ctx.reply("❌ Sahi Flipkart product link bhejo bhai!");
    
    let pid = "";
    try {
        const urlObj = new URL(fkLink);
        pid = urlObj.searchParams.get('pid');
        if (!pid) {
            const pidMatch = fkLink.match(/pid=([A-Z0-9]+)/i);
            if (pidMatch) pid = pidMatch[1];
        }
    } catch (e) { pid = ""; }

    if (!pid) {
        pid = Buffer.from(fkLink).toString('base64').substring(0, 10);
    }

    if (!activeUsers[chatId]) activeUsers[chatId] = [];
    if (activeUsers[chatId].some(item => item.id === pid)) return ctx.reply("⚠️ Yeh product pehle se track ho raha hai!");
    
    const intervalId = setInterval(() => { checkFlipkartStock(ctx, chatId, pid, fkLink); }, CHECK_INTERVAL);
    activeUsers[chatId].push({ id: pid, url: fkLink, interval: intervalId });
    
    ctx.reply(`🚀 **Flipkart Tracking Active!**\n📦 Product locked successfully.\nStock scanning live...`);
    checkFlipkartStock(ctx, chatId, pid, fkLink);
});

// --- COMMAND: LIST TRACK (USER & ADMIN) ---
bot.command('list_track', (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isUserApproved(userId)) return ctx.reply("❌ Aap approved nahi hain.");
    
    const chatId = ctx.chat.id.toString();
    if (!activeUsers[chatId] || activeUsers[chatId].length === 0) {
        return ctx.reply("😴 Koyi active tracking links nahi chal rahe hain.");
    }
    
    let msg = "📋 **Aapke Active Tracking Links:**\n\n";
    activeUsers[chatId].forEach((item, index) => {
        msg += `${index + 1}. 🆔 ID: \`${item.id}\` \n🔗 Link: ${item.url}\n\n`;
    });
    ctx.reply(msg, { parse_mode: 'Markdown', disable_web_page_preview: true });
});

// --- COMMAND: STOP ALL (USER & ADMIN) ---
bot.command('stop_all', (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isUserApproved(userId)) return ctx.reply("❌ Aap approved nahi hain.");
    
    const chatId = ctx.chat.id.toString();
    if (activeUsers[chatId] && activeUsers[chatId].length > 0) {
        activeUsers[chatId].forEach(item => clearInterval(item.interval));
        delete activeUsers[chatId];
        ctx.reply("🛑 Saari active tracking band kar di gayi hain.");
    } else { 
        ctx.reply("⚠️ Koyi active tracking nahi mili."); 
    }
});

// --- CORE SCRAPER ENGINE ---
async function checkFlipkartStock(ctx, chatId, pid, originalUrl) {
    if (!activeUsers[chatId]) return;
    const itemIndex = activeUsers[chatId].findIndex(item => item.id === pid);
    if (itemIndex === -1) return;

    try {
        const response = await axios.get(originalUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 8000
        });

        const html = response.data;
        const lowerHtml = html.toLowerCase();

        const isSoldOut = lowerHtml.includes('this item is currently out of stock') || 
                          lowerHtml.includes('coming soon') || 
                          lowerHtml.includes('sold out') ||
                          lowerHtml.includes('out of stock');

        const hasBuyButtons = lowerHtml.includes('buy now') || lowerHtml.includes('add to cart');

        let price = "N/A";
        let priceMatch = html.match(/₹\s*[0-9,]+/);
        if (priceMatch) price = priceMatch[0].trim();

        if (!isSoldOut && hasBuyButtons) {
            await bot.telegram.sendMessage(chatId, `🚨 **FLIPKART STOCK ALERT** 🚨\n\n🔥 bhai product *IN STOCK* aa gaya hai! Dhadadhad order maro! 🔥\n\n💰 **Price:** ${price}\n\nLink:\n${originalUrl}`,
                Markup.inlineKeyboard([[Markup.button.callback('Stop Tracking 🛑', `stop_fk_${itemIndex}`)]])
            ).catch(() => {});
        }
    } catch (e) {}
}

bot.launch().then(() => console.log("Master File-DB Engine Live and Running..."));
