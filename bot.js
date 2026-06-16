const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const express = require('express');

// --- CONFIGURATION ---
const BOT_TOKEN = '8501862664:AAGI3rJVaW4c9Baud3hXs7WO2Ryi0wuxfjA'; 
const ADMIN_CHAT_ID = '7485181331'; 
const CHECK_INTERVAL = 15000; // 15 Seconds loop
const RENDER_URL = 'https://instamart-tracker-bot.onrender.com/'; 
// ---------------------

const bot = new Telegraf(BOT_TOKEN);
const activeUsers = {};
const awaitingPincode = {}; // Hyperlocal Session Tracker

if (!global.fkApprovedList) {
    global.fkApprovedList = [ADMIN_CHAT_ID.toString(), '7485181331'];
}

const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.status(200).send('Flipkart & Minutes Hybrid Engine Online!'));
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 FK Hybrid Port Binding Successful on ${PORT}`));

// 🔥 ALIVE JHATKA SYSTEM
setInterval(() => {
    axios.get(RENDER_URL).catch(() => {}); 
}, 30000); 

function isUserApproved(userId) {
    if (!userId) return false;
    return global.fkApprovedList.map(String).includes(userId.toString());
}

bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const chatId = ctx.chat.id.toString();
    
    if (data.startsWith('stop_fk_')) {
        const index = parseInt(data.split('_')[2]);
        if (activeUsers[chatId] && activeUsers[chatId][index]) {
            const removedItem = activeUsers[chatId][index];
            clearInterval(removedItem.interval);
            activeUsers[chatId].splice(index, 1);
            await ctx.answerCbQuery("Flipkart tracking band kar di gayi hai! 🛑").catch(() => {});
            return ctx.reply(`🛑 Stopped tracking for:\n${removedItem.url}`, { disable_web_page_preview: true });
        }
    }
});

bot.start((ctx) => {
    const userId = ctx.from.id.toString();
    const name = `${ctx.from.first_name || ''}`.trim();
    
    if (userId === ADMIN_CHAT_ID.toString() || !global.fkApprovedList.includes(userId)) {
        if (!global.fkApprovedList.includes(userId)) {
            global.fkApprovedList.push(userId);
        }
    }

    if (isUserApproved(userId)) {
        return ctx.reply(`🤖 *Welcome ${name}!*\n\nFlipkart Regular & **Flipkart Minutes (Hyperlocal)** Tracker Active!\n\n🔹 **Format:**\n\`/track_fk <Product_URL>\`\n\n🔹 \`/stop_all_fk\``, { parse_mode: 'Markdown' });
    }
    ctx.reply(`🔒 *Access Denied!* ID: \`${userId}\``);
});

bot.command('track_fk', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isUserApproved(userId)) return ctx.reply("❌ Aap approved nahi hain.");
    
    const chatId = ctx.chat.id.toString();
    const args = ctx.message.text.replace(/\n/g, ' ').split(' ').filter(arg => arg.trim() !== '');
    
    let fkLink = args.find(arg => arg.includes('flipkart.com/'));
    if (!fkLink) return ctx.reply("❌ Valid Flipkart ya Flipkart Minutes link bhejo bhai!");
    
    // --- 🚨 HYPERLOCAL MINUTES CHECK ---
    if (fkLink.toLowerCase().includes('minutes') || fkLink.toLowerCase().includes('hyperlocal')) {
        awaitingPincode[chatId] = { url: fkLink };
        return ctx.reply("🛵 **Flipkart Minutes Link Detected!**\n\nBhai is area ka **6-digit Pincode** bhejo jahan stock check karna hai:");
    }

    // Regular Flipkart Engine Processing
    processRegularFK(ctx, chatId, fkLink);
});

// --- 🎯 PINCODE LISTENER FOR MINUTES ENGINE ---
bot.on('text', async (ctx, next) => {
    const chatId = ctx.chat.id.toString();
    const text = ctx.message.text.trim();

    if (awaitingPincode[chatId]) {
        // Validate if 6 digit number
        if (/^\d{6}$/.test(text)) {
            const fkLink = awaitingPincode[chatId].url;
            const pincode = text;
            delete awaitingPincode[chatId]; // Clear session state

            let uniqueId = Buffer.from(fkLink + pincode).toString('base64').substring(0, 10);

            if (!activeUsers[chatId]) activeUsers[chatId] = [];
            if (activeUsers[chatId].some(item => item.id === uniqueId)) {
                return ctx.reply("⚠️ Yeh item is pincode par pehle se track ho raha hai!");
            }

            const intervalId = setInterval(() => { checkMinutesStock(ctx, chatId, uniqueId, fkLink, pincode); }, CHECK_INTERVAL);
            activeUsers[chatId].push({ id: uniqueId, url: fkLink, pincode: pincode, interval: intervalId, isMinutes: true });

            ctx.reply(`🚀 **Flipkart Minutes Tracking Live!**\n📌 Pincode Locked: \`${pincode}\`\nStock checking shuru ho gayi hai...`);
            checkMinutesStock(ctx, chatId, uniqueId, fkLink, pincode);
        } else {
            ctx.reply("⚠️ Galat pincode! Kripya sahi 6-digit ka pincode bhejo (e.g. 110001):");
        }
        return;
    }
    return next();
});

function processRegularFK(ctx, chatId, fkLink) {
    let pid = "";
    try {
        const urlObj = new URL(fkLink);
        pid = urlObj.searchParams.get('pid');
    } catch (e) { pid = ""; }

    if (!pid) {
        pid = Buffer.from(fkLink).toString('base64').substring(0, 10);
    }

    if (!activeUsers[chatId]) activeUsers[chatId] = [];
    if (activeUsers[chatId].some(item => item.id === pid)) return ctx.reply("⚠️ Yeh product pehle se track ho raha hai!");
    
    const intervalId = setInterval(() => { checkFlipkartStock(ctx, chatId, pid, fkLink); }, CHECK_INTERVAL);
    activeUsers[chatId].push({ id: pid, url: fkLink, interval: intervalId, isMinutes: false });
    
    ctx.reply(`🚀 **Regular Flipkart Tracking Active!**\nScanning stock updates...`);
    checkFlipkartStock(ctx, chatId, pid, fkLink);
}

bot.command('stop_all_fk', (ctx) => {
    const chatId = ctx.chat.id.toString();
    if (activeUsers[chatId] && activeUsers[chatId].length > 0) {
        activeUsers[chatId].forEach(item => clearInterval(item.interval));
        delete activeUsers[chatId];
        ctx.reply("🛑 Saari Flipkart & Minutes tracking band kar di gayi.");
    } else { ctx.reply("⚠️ Koyi active tracking nahi mili."); }
});

// --- ⚡ CORE ENGINE: FLIPKART MINUTES LOCALIZED SCRAPER ---
async function checkMinutesStock(ctx, chatId, uniqueId, originalUrl, pincode) {
    if (!activeUsers[chatId]) return;
    const itemIndex = activeUsers[chatId].findIndex(item => item.id === uniqueId);
    if (itemIndex === -1) return;

    try {
        const response = await axios.get(originalUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Cookie': `pincode=${pincode}; sn=${pincode};` // Injects delivery pincode directly into Flipkart Quick Commerce Session
            },
            timeout: 9000
        });

        const html = response.data;
        const lowerHtml = html.toLowerCase();

        // Minutes specific structural markers
        const isSoldOut = lowerHtml.includes('out of stock') || 
                          lowerHtml.includes('currently unavailable') || 
                          lowerHtml.includes('not deliverable') ||
                          lowerHtml.includes('sold out');

        // Minutes engine uses 'ADD' or '+ ADD' style action triggers similar to instamart
        const hasAddTrigger = lowerHtml.includes('add') || lowerHtml.includes('buy now') || html.includes('ADD');

        let price = "N/A";
        let priceMatch = html.match(/₹\s*[0-9,]+/);
        if (priceMatch) price = priceMatch[0].trim();

        if (!isSoldOut && hasAddTrigger) {
            await bot.telegram.sendMessage(chatId, `🚨 **FLIPKART MINUTES ALARM** 🚨\n\n⚡ bhai aapke area pincode *${pincode}* par item back in stock aa gaya hai!\n\n💰 **Price:** ${price}\n\nLink:\n${originalUrl}`,
                Markup.inlineKeyboard([[Markup.button.callback('Stop Tracking 🛑', `stop_fk_${itemIndex}`)]])
            ).catch(() => {});
        }
    } catch (e) {
        // Safe protection drops
    }
}

// --- 📦 CORE ENGINE: REGULAR FLIPKART SCRAPER ---
async function checkFlipkartStock(ctx, chatId, pid, originalUrl) {
    if (!activeUsers[chatId]) return;
    const itemIndex = activeUsers[chatId].findIndex(item => item.id === pid);
    if (itemIndex === -1) return;

    try {
        const response = await axios.get(originalUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
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
            await bot.telegram.sendMessage(chatId, `🚨 **FLIPKART STOCK ALERT** 🚨\n\n🔥 bhai product *IN STOCK* aa gaya hai!\n\n💰 **Price:** ${price}\n\nLink:\n${originalUrl}`,
                Markup.inlineKeyboard([[Markup.button.callback('Stop Tracking 🛑', `stop_fk_${itemIndex}`)]])
            ).catch(() => {});
        }
    } catch (e) {}
}

bot.launch().then(() => console.log("Flipkart & Minutes Hybrid Engine Connected..."));
