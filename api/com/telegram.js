// com/telegram.js
const getTelegramConfig = () => ({
    token: process.env.TELEGRAM_TOKEN,
    dashboardUrl: process.env.DASHBOARD_URL,
    chatId: "8536107228"
});

export async function SendMessage(msgData) {
    const config = getTelegramConfig();
    try {
        const url = `https://api.telegram.org/bot${config.token}/sendMessage`;
        const cleanText = msgData.replace(/[*_`\[\]]/g, '');

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                chat_id: String(config.chatId).trim(), 
                text: cleanText 
            })
        });

        const resContent = await response.text();
        if (response.status === 200) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        return false;
    }
}

export async function ReceiveMessage(msgData) {
    if (!msgData || !msgData.message || !msgData.message.reply_to_message) {
        return false;
    }

    const replyText = msgData.message.text;
    const originalText = msgData.message.reply_to_message.text;
    const idMatch = originalText.match(/ID:?\s*([^|\s\n]+)/i);
    
    if (idMatch) {
        const taskId = idMatch[1].trim(); 
        
        const config = getTelegramConfig();
        const url = `https://api.telegram.org/bot${config.token}/sendMessage`;
        
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                chat_id: String(msgData.message.chat.id), 
                text: `✅ Đã ghi nhận ID ${taskId}.`,
                reply_markup: { 
                    inline_keyboard: [[{ text: "📊 Mở Dashboard", url: config.dashboardUrl + "?id=" + taskId }]] 
                }
            })
        });
        
        const resContent = await response.text();
        return true;
    }
    return false;
}