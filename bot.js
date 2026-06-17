const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const express = require('express');
const fs = require('fs'); // Permanent Storage ke liye
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

// Helper to escape special MarkdownV2 characters safely
function escapeMarkdown(text) {
    if (!text) return '';
    return String(text).replace(/[_*\[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

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
            saveApprovedUsers(currentList); 
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
