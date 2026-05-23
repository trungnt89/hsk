//import * as util from './com/sheet';
const util = require('./com/sheet');
// Sử dụng biến môi trường (Environment Variables) trên Vercel để bảo mật Key
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;


const spreadsheetId = "1UiAS_mUhl6j6wHyPkNiol9pclzkQJWD4qzPIZD2sx3k";
const SHEET_1 = "DairyList";
const SHEET_2 = "Promt";
	
	

/**
 * Handler chính cho Vercel (Serverless Function)
 */
export default async function handler(req, res) {
  // Chỉ cho phép phương thức POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { content, lessionId } = req.body;
  let promt = "Hãy viết 1 đoạn văn 200 chữ bằng TIẾNG NHẬT trình độ N4,N3 (---PARAGRAPH---) và 1 hội thoại thể lịch sự,trang trọng N4,N3 giữa 2 người A và B (---CONVERSATION---).Yêu cầu: Không lời chào, Không giải thích. Không cần viết cách đọc hira của kanji. Bố cục ,đoạn văn rõ ràng gồm 3 phần: đầu- thân - cuối. 3 Đoạn văn và hội thoại có phân cách xuống dòng,khi xuống dòng thì cách nhau thêm 1 dòng trống nữa đễ nhìn rõ ràng, rành mạch , dễ nhìn cho cả hội thoại và đoạn văn. Viết theo lối văn đoạn mở đầu là mở ra vấn đề,đoạn thân bài là giải thích,diễn giải,quy nạp.Đoạn cuối là kết luận.Cam kết KHÔNG được sử dụng từ vựng,ngữ pháp N2,N1";
  
  await util.ensureAuthenticated();
  let resPromt = await util.handleReadByPosVal(spreadsheetId, SHEET_2, 2, 1);
  writeLog(JSON.stringify(resPromt));
  if (resPromt && resPromt.values && resPromt.values.length > 0) {
  	promt = resPromt.values[0].data ? resPromt.values[0].data[1] : resPromt.values[0][1];
  } else {
  	writeLog("Cảnh báo: Không tìm thấy dữ liệu prompt!");
  }
  
  promt += "\n\nNội dung: " + content;
  writeLog(promt);
  writeLog(`--- Bắt đầu xử lý yêu cầu cho ID: ${lessionId} ---`);
  
  
  let fullText = null;
  try {
    // Bước 1: Thử DeepSeek
    try {
      fullText = await callDeepSeek(promt);
    } catch (e) {
      writeLog(`DeepSeek lỗi: ${e.message}`);
      // Bước 2: Thử Gemini nếu DeepSeek lỗi
      fullText = await callGemini(promt);
    }

    if (!fullText) throw new Error("Cả hai dịch vụ AI đều không phản hồi.");

    // Logic tách chuỗi (Giữ nguyên logic cũ)
    const parts = fullText.split("---CONVERSATION---");
    const pPart = parts[0].replace("---PARAGRAPH---", "").trim();
    const cPart = parts[1] ? parts[1].trim() : "";

    writeLog('Parsed thành công Paragraph và Conversation');

    
    const pos = 0;
    const val = lessionId;
    
    let result = await util.handleReadByPosVal(spreadsheetId, SHEET_1, pos, val);
    
    var rawData = result.values[0].data;
	
	// Bắt đầu đếm từ 0
    // Bắt đầu đếm từ 0
	rawData[3] = pPart; // Cập nhật vào cột 4 (index 3)
	rawData[4] = cPart; // Cập nhật vào cột 5 (index 4)
	rawData[7] = '=GOOGLETRANSLATE(INDIRECT("D"&ROW()),"ja","vi")'; // Cập nhật vào cột 8 (index 7)
	rawData[8] = '=GOOGLETRANSLATE(INDIRECT("E"&ROW()),"ja","vi")'; // Cập nhật vào cột 9 (index 8)
    
	
	
    await util.handleUpdateByPosVal(spreadsheetId, SHEET_1, pos, val, rawData);

    // Trả về kết quả
    return res.status(200).json({
      status: 'success',
      id: lessionId,
      paragraph: pPart,
      conversation: cPart
    });

  } catch (error) {
    writeLog(`Error in Proxy: ${error.message}`);
    return res.status(500).json({ status: 'error', message: error.message });
  }
}

/**
 * Hàm gọi API DeepSeek
 */
async function callDeepSeek(prompt) {
  writeLog("Đang gọi DeepSeek...");
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    })
  });
  
  const json = await response.json();
  writeLog(JSON.stringify(json));
  if (!response.ok) {
    throw new Error(`DeepSeek Error: ${json.error?.message || response.statusText}`);
  }
  
  writeLog("DeepSeek phản hồi thành công.");
  return json.choices[0].message.content;
}

/**
 * Hàm gọi API Gemini
 */
async function callGemini(prompt) {
  writeLog("Đang chuyển sang phương án dự phòng: Gemini...");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const json = await response.json();
  writeLog(JSON.stringify(json),"Gemini");
  if (!response.ok) {
    throw new Error(`Gemini Error: ${json.error?.message || response.statusText}`);
  }

  writeLog("Gemini phản hồi thành công.");
  return json.candidates[0].content.parts[0].text;
}

// Hàm ghi Log (giả lập writeLog của GAS)
const writeLog = (message) => {
  util.writeLog(message, "AI GENERATE");
};