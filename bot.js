const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const express = require('express');
const fs = require('fs'); // Permanent Storage ke liye
const path = require('path');

// --- CONFIGURATION ---
const BOT_TOKEN = '8923597334:AAEm75cG0EbDinDksLc2Dki28EYfjbfS_eQ'; 
const ADMIN_CHAT_ID = '7485181331'; 
const CHECK_INTERVAL = 15000; 
const DB_FILE = path.join(__dirname, 'database.json');
// ---------------------

const bot = new Telegraf(BOT_TOKEN);
const activeUsers = {};
const userSessions = {}; // User ka status check rakhne ke liye

// Helper to escape special MarkdownV2 characters safely
function escapeMarkdown(text) {
    if (!text) return '';
    return String(text).replace(/[_*\[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// Permanent Control Panel Keyboard Layout
const getProKeyboard = () => {
    return Markup.keyboard([
        ['🚀 Start Track', '📋 List Active'],
        ['🛑 Stop All Operations']
    ]).resize();
};

// --- 📂 PERMANENT DATABASE STORAGE LOGIC ---
function loadApprovedUsers() {
    try {
        if (!fs.existsSync(DB_FILE)) {
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
        return [ADMIN_CHAT_ID.toString()];
    }
}

function saveApprovedUsers(usersList) {
    try {
        const uniqueUsers = [...new Set(usersList.map(String))];
        fs.writeFileSync(DB_FILE, JSON.stringify(uniqueUsers, null, 2));
    } catch (e) {}
}

function isUserApproved(userId) {
    if (!userId) return false;
    const currentList = loadApprovedUsers();
    return currentList.includes(userId.toString());
}
// --------------------------------------------

// --- CALLBACK BUTTONS HANDLER ---
bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const chatId = ctx.chat.id.toString();
    const clickerId = ctx.from.id.toString();
    
    // Handling Inline Dynamic Stop via List Track Cards
    if (data.startsWith('stop_fk_pid_')) {
        const targetPid = data.split('_')[3];
        
        if (activeUsers[chatId] && activeUsers[chatId].length > 0) {
            const index = activeUsers[chatId].findIndex(item => item.id === targetPid);
            
            if (index !== -1) {
                const removedItem = activeUsers[chatId][index];
                clearInterval(removedItem.interval); 
                activeUsers[chatId].splice(index, 1); 
                
                await ctx.answerCbQuery("Tracking band kar di gayi hai! 🛑").catch(() => {});
                
                return ctx.editMessageText(`🛑 **Tracking Stopped Permanently\\!**\n\n📦 *Product ID:* \`${escapeMarkdown(targetPid)}\`\n🔗 *Link:* [Open Flipkart](${removedItem.url})`, { 
                    parse_mode: 'MarkdownV2',
                    disable_web_page_preview: true 
                }).catch(() => {});
            }
        }
        return ctx.answerCbQuery("⚠️ Target already stopped or not found.").catch(() => {});
    }

    if (clickerId !== ADMIN_CHAT_ID.toString()) {
        return ctx.answerCbQuery("❌ Unauthorized! Sirf Admin click kar sakta hai.").catch(() => {});
    }
    
    const targetUserId = data.split('_')[1].trim();
    let currentList = loadApprovedUsers();
    
    if (data.startsWith('approve_')) {
        if (!currentList.includes(targetUserId)) {
            currentList.push(targetUserId);
            saveApprovedUsers(currentList); 
        }
        await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n✅ **Status: Approved Permanently!**`).catch(() => {});
        await bot.telegram.sendMessage(targetUserId, "🎉 **Mubarak ho! Admin ne aapka access approve kar diya hai! Neeche diye gaye control panel se tracking chalu karo.**", getProKeyboard()).catch(() => {});
    } else if (data.startsWith('decline_')) {
        await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n❌ **Status: Declined!**`).catch(() => {});
        await bot.telegram.sendMessage(targetUserId, "❌ Sorry! Admin ne aapka access request decline kar diya hai.").catch(() => {});
    }
    await ctx.answerCbQuery().catch(() => {});
});

// --- COMMAND: START (REQUEST SYSTEM WITH KEYBOARD MENU) ---
bot.start((ctx) => {
    const userId = ctx.from.id.toString();
    if (isUserApproved(userId)) {
        delete userSessions[userId]; // State reset
        return ctx.reply(`🤖 *Welcome ${ctx.from.first_name || ''}!* Secret Control Panel Activated!\n\nNeeche diye gaye buttons par click karke direct use karo boss, ab kuch type karne ka jhanjhat nahi! 😎`, getProKeyboard());
    }
    
    ctx.reply(`🔒 **Access Denied!**\n\nAap abhi approved nahi hain.\nAapki Telegram ID: \`${userId}\`\n\nAdmin ke paas request bhej di gayi hai, kripya wait karein...`);
    
    bot.telegram.sendMessage(ADMIN_CHAT_ID, 
        `🚨 **New Access Request!**\n\n👤 Name: ${ctx.from.first_name || ''}\n🆔 ID: \`${userId}\`\n\n👉 Approve karne ke liye niche click karein ya type karein:\n\`/approve ${userId}\``,
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

// --- HIGH-PRIORITY ADMIN COMMANDS SYSTEM ---
bot.command('approve', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID.toString()) return ctx.reply("❌ Sirf Admin hi approve kar sakta hai!");
    const args = ctx.message.text.split(' ').filter(arg => arg.trim() !== '');
    if (args.length < 2) return ctx.reply("⚠️ Format: `/approve <User_ID>`");
    
    const targetUserId = args[1].trim();
    let currentList = loadApprovedUsers();

    if (!currentList.includes(targetUserId)) {
        currentList.push(targetUserId);
        saveApprovedUsers(currentList); 
        ctx.reply(`✅ User ID \`${targetUserId}\` ko permanent approve kar diya gaya.`);
        bot.telegram.sendMessage(targetUserId, "🎉 **Mubarak ho! Admin ne aapka access approve kar diya hai!**", getProKeyboard()).catch(() => {});
    } else {
        ctx.reply("⚠️ Yeh user pehle se hi approved hai.");
    }
});

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
        saveApprovedUsers(currentList); 
        ctx.reply(`❌ User ID \`${targetUserId}\` ka access permanent delete kar diya gaya.`);
        bot.telegram.sendMessage(targetUserId, "🔒 **bhai admin ne tera access hata diya hai** 🚫", Markup.removeKeyboard()).catch(() => {});
        
        if (activeUsers[targetUserId]) {
            activeUsers[targetUserId].forEach(item => clearInterval(item.interval));
            delete activeUsers[targetUserId];
        }
    } else {
        ctx.reply("⚠️ Yeh ID database list mein nahi mili.");
    }
});

// --- CORE PANEL BUTTON INTERFACES (HEARS MAPPER) ---
bot.hears('🚀 Start Track', (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isUserApproved(userId)) return;
    userSessions[userId] = 'awaiting_link';
    ctx.reply("🕵️‍♂️ **Stock Engine Scanner Ready!**\n\nAb seedha Flipkart ka **link paste karke send kar do** bhai!");
});

bot.hears('📋 List Active', (ctx) => { displayActiveTracks(ctx); });
bot.hears('🛑 Stop All Operations', (ctx) => { killAllOperations(ctx); });

// Fallback legacy command matching structures
bot.command('start_track', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isUserApproved(userId)) return;
    userSessions[userId] = 'awaiting_link';
    ctx.reply("🕵️‍♂️ **Stock Engine Scanner Ready!**\n\nAb seedha Flipkart ka **link paste karke send kar do** bhai!");
});
bot.command('list_track', (ctx) => { displayActiveTracks(ctx); });
bot.command('stop_all', (ctx) => { killAllOperations(ctx); });


// --- 🧠 SMART PANEL TEXT MESSAGES INTERCEPTOR ENGINE ---
bot.on('text', async (ctx) => {
    const userId = ctx.from.id.toString();
    const chatId = ctx.chat.id.toString();
    if (!isUserApproved(userId)) return;

    const textInput = ctx.message.text.trim();

    // Panel strings ko normal texts me interpret hone se block karo
    if (['🚀 Start Track', '📋 List Active', '🛑 Stop All Operations'].includes(textInput)) return;
    if (textInput.startsWith('/')) return;

    // Awaiting state checks for active link pasting
    if (userSessions[userId] === 'awaiting_link') {
        const args = textInput.replace(/\n/g, ' ').split(' ').filter(arg => arg.trim() !== '');
        let fkLink = args.find(arg => arg.includes('flipkart.com/'));

        if (!fkLink) {
            return ctx.reply(`❌ **Abe saaf link bhejo Agent!**\nInput mein Flipkart ka link nahi mila. Dobara sahi se link bhejo!`, getProKeyboard());
        }

        setupCoreScraperSystem(ctx, fkLink);
        delete userSessions[userId]; // Session clear after tracking deployment
    } else {
        if (textInput.includes('flipkart.com/')) {
            ctx.reply(`💡 **Bhai pehle panel se "🚀 Start Track" select karo, fir link bhejo!**`, getProKeyboard());
        }
    }
});


// Core Scraper Link Deployment Wrapper
function setupCoreScraperSystem(ctx, fkLink) {
    const chatId = ctx.chat.id.toString();
    
    let pid = "";
    try {
        const urlObj = new URL(fkLink);
        pid = urlObj.searchParams.get('pid');
        if (!pid) {
            const pidMatch = fkLink.match(/pid=([A-Z0-9]+)/i);
            if (pidMatch) pid = pidMatch[1];
        }
    } catch (e) {}

    if (!pid) {
        pid = Buffer.from(fkLink).toString('base64').substring(0, 10);
    }

    if (!activeUsers[chatId]) activeUsers[chatId] = [];
    if (activeUsers[chatId].some(item => item.id === pid)) return ctx.reply("⚠️ Yeh product pehle se track ho raha hai!");
    
    const intervalId = setInterval(() => { checkFlipkartStock(ctx, chatId, pid, fkLink); }, CHECK_INTERVAL);
    activeUsers[chatId].push({ id: pid, url: fkLink, interval: intervalId });
    
    ctx.reply(`🚀 **Flipkart Tracking Active!**\n📦 Product locked successfully.\nStock scanning live...`, getProKeyboard());
    checkFlipkartStock(ctx, chatId, pid, fkLink);
}

function displayActiveTracks(ctx) {
    const userId = ctx.from.id.toString();
    const chatId = ctx.chat.id.toString();
    if (!isUserApproved(userId)) return;
    
    const currentList = activeUsers[chatId] || activeUsers[userId] || [];
    if (currentList.length === 0) {
        return ctx.reply("😴 Koyi active tracking links nahi chal rahe hain.", getProKeyboard());
    }
    
    ctx.reply("📋 **Radar Par Locked Targets Matrix:**", getProKeyboard());

    for (let i = 0; i < currentList.length; i++) {
        const item = currentList[i];
        const msg = `*Target #${i + 1}*\n📦 *ID:* \`${escapeMarkdown(item.id)}\`\n🔗 *Link:* [Open Product](${item.url})`;
        
        ctx.reply(msg, {
            parse_mode: 'MarkdownV2',
            disable_web_page_preview: true,
            ...Markup.inlineKeyboard([
                [Markup.button.callback('Stop Tracking 🛑', `stop_fk_pid_${item.id}`)]
            ])
        }).catch(() => {});
    }
}

function killAllOperations(ctx) {
    const userId = ctx.from.id.toString();
    const chatId = ctx.chat.id.toString();
    if (!isUserApproved(userId)) return;
    
    const targets = activeUsers[chatId] || activeUsers[userId] || [];
    if (targets.length > 0) {
        targets.forEach(item => clearInterval(item.interval));
        delete activeUsers[chatId];
        delete activeUsers[userId];
        ctx.reply("🛑 Saari active tracking band kar di gayi hain.", getProKeyboard());
    } else { 
        ctx.reply("⚠️ Koyi active tracking nahi mili.", getProKeyboard()); 
    }
}

// --- 🔬 CORE BREAKDOWN SCRAPER ENGINE ---
async function checkFlipkartStock(ctx, chatId, pid, originalUrl) {
    if (!activeUsers[chatId]) return;
    const itemIndex = activeUsers[chatId].findIndex(item => item.id === pid);
    if (itemIndex === -1) return;

    try {
        const response = await axios.get(originalUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            timeout: 10000
        });

        const html = response.data;
        const lowerHtml = html.toLowerCase();

        let isOutOfStock = false;
        const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
        
        if (jsonLdMatch && jsonLdMatch[1]) {
            try {
                const jsonData = JSON.parse(jsonLdMatch[1].trim());
                const itemData = Array.isArray(jsonData) ? jsonData.find(i => i["@type"] === "Product" || i.offers) : jsonData;
                if (itemData && itemData.offers) {
                    const availability = Array.isArray(itemData.offers) ? itemData.offers[0].availability : itemData.offers.availability;
                    if (availability && String(availability).toLowerCase().includes('outofstock')) {
                        isOutOfStock = true;
                    }
                }
            } catch (e) {}
        }

        const hasOutKeywords = lowerHtml.includes('currently out of stock') || 
                               lowerHtml.includes('coming soon') || 
                               lowerHtml.includes('sold out') ||
                               lowerHtml.includes('out of stock');

        const isSoldOut = isOutOfStock || hasOutKeywords;
        const hasBuyButtons = lowerHtml.includes('buy now') || lowerHtml.includes('add to cart');

        let price = "N/A";
        if (jsonLdMatch && jsonLdMatch[1]) {
            try {
                const jsonData = JSON.parse(jsonLdMatch[1].trim());
                const itemData = Array.isArray(jsonData) ? jsonData.find(i => i["@type"] === "Product" || i.offers) : jsonData;
                if (itemData && itemData.offers) {
                    let priceVal = Array.isArray(itemData.offers) ? itemData.offers[0].price : itemData.offers.price;
                    if (priceVal) price = `₹${priceVal}`;
                }
            } catch (e) {}
        }
        if (price === "N/A") {
            let priceMatch = html.match(/"price"\s*:\s*"?([0-9]+)"?/i);
            if (priceMatch) price = `₹${priceMatch[1]}`;
        }

        if (!isSoldOut && hasBuyButtons) {
            const removedItem = activeUsers[chatId][itemIndex];
            clearInterval(removedItem.interval);
            activeUsers[chatId].splice(itemIndex, 1);

            await bot.telegram.sendMessage(chatId, 
                `🚨 **FLIPKART STOCK ALERT** 🚨\n\n🔥 *bhai product IN STOCK aa gaya hai! Dhadadhad order maro!* 🔥\n\n💰 **Real-Time Price:** *${price}*\n\n🔗 **Link:** ${originalUrl}`,
                getProKeyboard()
            ).catch(() => {});
        }
    } catch (e) {}
}

// --- EXPRESS WEB SERVER FOR RENDER PORT BINDING ---
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => res.status(200).send('Permanent Storage Panel Engine Live!'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Master Engine Port Binding Successful on ${PORT}`);
    
    setInterval(() => {
        const targetUrl = process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + PORT;
        axios.get(targetUrl).catch(() => {}); 
    }, 30000); 

    bot.launch({
        polling: {
            dropPendingUpdates: true 
        }
    }).then(() => console.log("Master Panel Engine Live and Running..."));
});
