// com/telegram.js
const getTelegramConfig = () => ({
    token: process.env.TELEGRAM_TOKEN,
    dashboardUrl: process.env.DASHBOARD_URL,
    chatId: "8536107228"
});

export async function SendMessage(msgData,referURL) {
    const config = getTelegramConfig();
    try {
        const url = `https://api.telegram.org/bot${config.token}/sendMessage`;
        const cleanText = msgData.replace(/[*_`\[\]]/g, '');

		let data = { 
                chat_id: String(config.chatId).trim(), 
				text: cleanText
        }
		
		if(referURL){
			data.reply_markup = { inline_keyboard: [[{ text: "📊 Mở Dashboard", url: referURL }]] }	
		}
		
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
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
    
    // FIX: Thay đổi regex để loại bỏ dấu đóng ngoặc 】 hoặc dấu đóng ngoặc khác ra khỏi cụm bắt group [1]
    const idMatch = originalText.match(/ID:?\s*([^|\s\n】]+)/i);
    if (idMatch) {
        const taskId = idMatch[1].trim(); 
        
        // FIX: Trả về object chứa cả 2 biến taskId và replyText thay vì chỉ trả về true
        return { taskId, replyText };
    }
    return false;
}