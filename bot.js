const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const express = require('express');
const fs = require('fs');
const path = require('path');

// --- 🔒 CONFIGURATION ---
const BOT_TOKEN = '8923597334:AAF_K4fyVa_paCIqhEaoBdb1kgVkWSLON8Y'; 
const ADMIN_CHAT_ID = '7485181331'; // Master ID
const CHECK_INTERVAL = 30000; // 30 second rapid parsing loop
const RENDER_URL = 'https://new-flipkart-tracker.onrender.com'; 
const DB_FILE = path.join(__dirname, 'database.json');
// ---------------------

const bot = new Telegraf(BOT_TOKEN);
const activeUsers = {};
const userSessions = {}; 

// HARD ENGINE RAM CACHE
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

const app = report => express();
const appInstance = express();
appInstance.get('/', (req, res) => res.status(200).send('Stock Matrix Radar Engine Fixed Live!'));
appInstance.listen(process.env.PORT || 10000, '0.0.0.0', () => console.log(`🚀 Stock System Binding Successful`));

setInterval(() => {
    axios.get(RENDER_URL).catch(() => {}); 
}, 30000); 

// 🔥 Modified Stock Management Keyboards
const getProKeyboard = () => {
    return Markup.keyboard([
        ['🚨 Lock Target (Stock)'],
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
            await ctx.editMessageText(`🛑 <b>Target [${index + 1}] Stock Radar se permanent hata diya gaya hai!</b> Link:<br><code>${removedItem.url}</code>`, { parse_mode: 'HTML', disable_web_page_preview: true }).catch(() => {});
            return;
        }
        return ctx.answerCbQuery("⚠️ Already stopped.").catch(() => {});
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
        await ctx.editMessageText(`❌ <b>Agent ${targetUserId} ka access permanent block kar diya gaya hai!</b>`, { parse_mode: 'HTML' }).catch(() => {});
        bot.telegram.sendMessage(targetUserId, "🔒 <b>Your stock session has been terminated by Admin.</b>").catch(() => {});
        return;
    }

    if (clickerId !== ADMIN_CHAT_ID.toString()) return ctx.answerCbQuery("❌ Unauthorized!").catch(() => {});
    const targetUserId = data.split('_')[1].trim();
    
    if (data.startsWith('approve_')) {
        if (!approvedUsersCache.includes(targetUserId)) {
            approvedUsersCache.push(targetUserId);
            saveApprovedUsers(approvedUsersCache);
        }
        await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n✅ **Agent Activated Permanently!**`).catch(() => {});
        await bot.telegram.sendMessage(targetUserId, "🎉 **Access Approved! Neeche se Stock check start karo.**", getProKeyboard()).catch(() => {});
    } else if (data.startsWith('decline_')) {
        await ctx.editMessageText(`${ctx.callbackQuery.message.text}\n\n❌ **Access Request Burnt!**`).catch(() => {});
    }
    await ctx.answerCbQuery().catch(() => {});
});

// --- COMMANDS MATRIX ---
bot.start((ctx) => {
    const userId = ctx.from.id.toString();
    const name = `${ctx.from.first_name || ''}`.trim();
    
    if (isUserApproved(userId)) {
        delete userSessions[userId]; 
        return ctx.reply(`🤖 *Welcome Agent ${name}!* Stock Control Panel Activated!\n\nNeeche button par click karke link bhejo boss! 😎`, getProKeyboard());
    }
    ctx.reply(`🔒 **Access Denied!** ID: \`${userId}\` \nAdmin ke verification ka wait karo.`);
    
    bot.telegram.sendMessage(ADMIN_CHAT_ID, `🚨 **New Agent Request!**\n👤 Name: *${name}*\n🆔 ID: \`${userId}\``, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('Approve ✅', `approve_${userId}`), Markup.button.callback('Decline ❌', `decline_${userId}`)]])
    }).catch(() => {});
});

bot.hears('🚨 Lock Target (Stock)', (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isUserApproved(userId)) return;
    userSessions[userId] = 'stockcheck'; 
    ctx.reply("🕵️‍♂️ **Stock Monitoring Engine Ready!**\n\nAb jis product ka stock track karna hai, uska **Flipkart link paste karke send kar do** bhai!");
});

bot.command('list_track', (ctx) => { displayActiveTracks(ctx); });
bot.hears('📋 List Active', (ctx) => { displayActiveTracks(ctx); });

bot.command('stop_all', (ctx) => { killAllOperations(ctx); });
bot.hears('🛑 Stop All Operations', (ctx) => { killAllOperations(ctx); });

// --- SMART INTERCEPTOR ---
bot.on('text', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isUserApproved(userId)) return;
    const textInput = ctx.message.text.trim();

    if (['🚨 Lock Target (Stock)', '📋 List Active', '🛑 Stop All Operations'].includes(textInput)) return;

    if (userSessions[userId] === 'stockcheck') {
        const args = textInput.replace(/\n/g, ' ').split(' ').filter(arg => arg.trim() !== '');
        let fkLink = args.find(arg => arg.includes('flipkart.com/'));

        if (!fkLink) {
            return ctx.reply(`❌ **Abe saaf link bhejo!** Input mein Flipkart link nahi mila.`, getProKeyboard());
        }

        setupCoreScraperSystem(ctx, fkLink);
        delete userSessions[userId]; 
    } else {
        if (textInput.includes('flipkart.com/')) {
            ctx.reply(`💡 **Bhai pehle button select karo!**\nNeeche panel se \`🚨 Lock Target (Stock)\` daba kar link bhejo!`, getProKeyboard());
        }
    }
});

function setupCoreScraperSystem(ctx, fkLink) {
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
    if (activeUsers[chatId].some(item => item.id === pid)) return ctx.reply("⚠️ Abe ye product pehle se hi stock radar par locked hai!");

    const intervalId = setInterval(() => { checkStockFluctuations(ctx, chatId, pid, fkLink); }, CHECK_INTERVAL);
    activeUsers[chatId].push({
        id: pid,
        url: fkLink,
        interval: intervalId,
        alertFired: false,
        lastStockStatus: null 
    });

    ctx.reply(`🕵️‍♂️ **Stock Radar Active!**\n\nBhai, jaise hi yeh item **IN STOCK** hoga (chahe raat ke 3 baje ho), tera bhai turant blast notification bhejega.\n\n☕ Chill karo ab aap!`);
    checkStockFluctuations(ctx, chatId, pid, fkLink);
}

function displayActiveTracks(ctx) {
    const userId = ctx.from.id.toString();
    if (!isUserApproved(userId)) return;
    const chatId = ctx.chat.id.toString();
    if (!activeUsers[chatId] || activeUsers[chatId].length === 0) return ctx.reply("😴 Abhi koi target stock radar par nahi hai.");
    
    let msg = "📋 <b>Locked Stock Targets Matrix:</b>\n\n";
    let keyboardButtons = [];
    let currentRow = [];

    for (let index = 0; index < activeUsers[chatId].length; index++) {
        const item = activeUsers[chatId][index];
        let statusDisplay = item.lastStockStatus || "Checking...";
        msg += `🔢 <b>Target [${index + 1}]</b>\n📦 <b>ID:</b> <code>${item.id}</code>\n📊 <b>Live Status:</b> <b>${statusDisplay}</b>\n🔗 <b>Link:</b> ${item.url}\n\n`;
        currentRow.push(Markup.button.callback(`Stop ${index + 1} 🛑`, `stop_fk_${index}`));
        if (currentRow.length === 2) { keyboardButtons.push(currentRow); currentRow = []; }
    }
    if (currentRow.length > 0) keyboardButtons.push(currentRow);

    ctx.reply(msg, { parse_mode: 'HTML', disable_web_page_preview: true, ...Markup.inlineKeyboard(keyboardButtons) }).catch(() => {});
}

function killAllOperations(ctx) {
    const userId = ctx.from.id.toString();
    if (!isUserApproved(userId)) return;
    const chatId = ctx.chat.id.toString();
    if (activeUsers[chatId] && activeUsers[chatId].length > 0) {
        activeUsers[chatId].forEach(item => clearInterval(item.interval));
        delete activeUsers[chatId];
        ctx.reply("🛑 Saare stock targets saaf kar diye gaye hain!");
    } else { ctx.reply("⚠️ Koyi active operation chal hi nahi rahi."); }
}

bot.command('manage_users', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_CHAT_ID.toString()) return ctx.reply("❌ **Access Denied!**");
    const rawUsers = approvedUsersCache.filter(id => id.toString() !== ADMIN_CHAT_ID.toString());
    if (rawUsers.length === 0) return ctx.reply("📋 Koi approved agent nahi hai.");
    
    let msg = "🛠 *Management Console:*\n\n";
    let keyboardButtons = [];
    rawUsers.forEach((u, i) => {
        msg += `${i + 1}. 🆔 User ID: <code>${u}</code>\n`;
        keyboardButtons.push([Markup.button.callback(`Remove User ${u} ❌`, `remusr_${u}`)]);
    });
    ctx.reply(msg, { parse_mode: 'HTML', ...Markup.inlineKeyboard(keyboardButtons) });
});

// --- 🔬 CORE STOCK PARSER ENGINE ---
async function checkStockFluctuations(ctx, chatId, pid, originalUrl) {
    if (!activeUsers[chatId]) return;
    const itemIndex = activeUsers[chatId].findIndex(item => item.id === pid);
    if (itemIndex === -1) return;

    try {
        const response = await axios.get(originalUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            },
            timeout: 12000 
        });

        const html = response.data;
        let currentStockStatus = "IN STOCK"; // Default assumption

        // 🔥 CRITICAL STOCK EXTRACTION SIGNAL LOOKUPS
        if (
            html.includes('NOT_AVAILABLE') || 
            html.includes('OUT_OF_STOCK') || 
            html.includes('"availability":"http://schema.org/OutOfStock"') ||
            html.match(/This item is currently out of stock/i) ||
            html.match(/Sold Out/i) ||
            html.match(/Coming Soon/i)
        ) {
            currentStockStatus = "OUT OF STOCK";
        }

        let instance = activeUsers[chatId][itemIndex];

        // First loop sync check
        if (instance.lastStockStatus === null) {
            instance.lastStockStatus = currentStockStatus;
            return;
        }

        // 🔥 SIGNAL BLOCK: Check if item went from OUT OF STOCK to IN STOCK
        if (currentStockStatus === "IN STOCK" && instance.lastStockStatus === "OUT OF STOCK") {
            instance.lastStockStatus = currentStockStatus;
            instance.alertFired = true;

            // Direct Immediate Alert Notification Blast!
            await bot.telegram.sendMessage(chatId, 
                `🔥 <b>LOOT ALERT: PRODUCT IS NOW IN STOCK!!</b> 🔥\n\n📦 <b>ID:</b> <code>${pid}</code>\n⚡ <b>Stock Status:</b> 🟢 <b>AVAILABLE NOW!</b>\n\nBina ek second waste kiye jaldi order lagao boss!\n\n🔗 <b>Order Link:</b> ${originalUrl}`,
                { 
                    parse_mode: 'HTML', 
                    ...Markup.inlineKeyboard([[Markup.button.callback('Stop Tracking 🛑', `stop_fk_${itemIndex}`)]]) 
                }
            ).catch(() => {});
            
            // Loop alert fired safely, stop interval loop to avoid spam
            clearInterval(instance.interval);
            return;
        }

        // Keep updating sync state if status is still same
        instance.lastStockStatus = currentStockStatus;

    } catch (err) {}
}

bot.telegram.deleteWebhook().then(() => {
    bot.launch().then(() => console.log("Stock Monitor Pro Radar System Live..."));
});
