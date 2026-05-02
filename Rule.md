--------------------------------------------
NGUYÊN TĂC SỬA :
1.liệt kê chỗ sửa đổi và lý do
2.Sửa lại nếu sửa ngoài 1 mà ko báo cáo. chỉ đc phép sửa đã liệt kê ở 1 
--------------------------------------------
YÊU CẦU : 
1. Full màn hình
2. TIết kiệm lại diện tích hiển thị , phần load thông tin hãy hiển thị nhỏ gọn 
--------------------------------------------
SRC BASE : 
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chuyên Gia Chấm Điểm Phát Âm Nhật Ngữ</title>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        :root { --primary: #1e3799; --accent: #007bff; --bg: #f4f7f6; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: var(--bg); padding: 20px; color: #333; line-height: 1.6; }
        .card { max-width: 850px; margin: 0 auto; background: white; padding: 30px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        h2 { text-align: center; color: var(--primary); margin-top: 0; border-bottom: 2px solid #eee; padding-bottom: 15px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; font-weight: bold; color: #444; }
        input[type="text"], input[type="file"], textarea { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; font-size: 15px; }
        textarea { height: 100px; resize: vertical; font-family: inherit; }
        button { background: var(--accent); color: white; border: none; padding: 15px; width: 100%; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.3s; margin-top: 10px; }
        button:hover { background: var(--primary); transform: translateY(-1px); }
        button:disabled { background: #ccc; cursor: not-allowed; }
        #status { margin: 15px 0; font-weight: bold; color: #666; display: flex; align-items: center; }
        #status::before { content: "●"; margin-right: 8px; color: #e67e22; }
        
        #result { margin-top: 25px; padding: 25px; background: #fff; border-left: 6px solid var(--primary); border-radius: 4px; display: none; border: 1px solid #e1e8ed; box-shadow: 0 4px 10px rgba(0,0,0,0.03); }
        #result h1, #result h2, #result h3 { color: var(--primary); margin-top: 15px; }
        #result ul, #result ol { padding-left: 20px; }
        #result blockquote { border-left: 4px solid #ccc; padding-left: 15px; font-style: italic; color: #555; }
        #result table { border-collapse: collapse; width: 100%; margin: 15px 0; }
        #result table, #result th, #result td { border: 1px solid #ddd; padding: 8px; }
        #result th { background-color: #f2f2f2; }

        .log-box { margin-top: 30px; background: #2d3436; color: #00ff00; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 11px; max-height: 150px; overflow-y: auto; }
        #audioPreview { margin-top: 10px; width: 100%; height: 40px; display: none; }
    </style>
</head>
<body>

<div class="card">
    <h2>Phân Tích & Chấm Điểm Phát Âm</h2>
    
    <div class="form-group">
        <label>Gemini API Key:</label>
        <input type="text" id="apiKey" placeholder="Nhập API Key...">
    </div>

    <div class="form-group">
        <label>Kịch bản gốc (Script tiếng Nhật):</label>
        <textarea id="originalScript" placeholder="Nhập đoạn văn bản tiếng Nhật bạn định nói vào đây..."></textarea>
    </div>

    <div class="form-group">
        <label>File ghi âm (.m4a, .mp3, .wav):</label>
        <input type="file" id="audioFile" accept="audio/*">
        <audio id="audioPreview" controls></audio>
    </div>

    <button id="analyzeBtn">Phân Tích & Chấm Điểm</button>

    <div id="status">Trạng thái: Sẵn sàng</div>
    <div id="result"></div>

    <div class="log-box" id="logBox">Logs: Hệ thống đã sẵn sàng.</div>
</div>

<script>
    const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyHaN7aostdFCFCnR7i-aBCCbYmyaREoxICcu8OzzLZztDpPFP1aGwBUUz-y0forKnSqw/exec";
    const DB_NAME = 'MediaCacheDB'; 
    const STORE_NAME = 'media';     
    const SETTINGS_DB_NAME = 'JP_Score_DB_v1';
    const SETTINGS_STORE_NAME = 'settings';

    const apiKeyInput = document.getElementById('apiKey');
    const scriptInput = document.getElementById('originalScript');
    const audioInput = document.getElementById('audioFile');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const resultDiv = document.getElementById('result');
    const statusDiv = document.getElementById('status');
    const logBox = document.getElementById('logBox');
    const audioPreview = document.getElementById('audioPreview');

    let currentBlob = null;

    function addLog(msg) {
        const t = new Date().toLocaleTimeString();
        logBox.innerText += `\n[${t}] ${msg}`;
        logBox.scrollTop = logBox.scrollHeight;
    }

    async function initSettingsDB() {
        return new Promise(res => {
            const req = indexedDB.open(SETTINGS_DB_NAME, 1);
            req.onupgradeneeded = e => {
                if (!e.target.result.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
                    e.target.result.createObjectStore(SETTINGS_STORE_NAME);
                }
            };
            req.onsuccess = () => res(req.result);
        });
    }

    async function loadDataFromCache() {
        return new Promise(res => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onsuccess = e => {
                try {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        return res(null);
                    }
                    const tx = db.transaction(STORE_NAME, 'readonly');
                    const store = tx.objectStore(STORE_NAME);
                    const getReq = store.get('current_media');
                    getReq.onsuccess = () => res(getReq.result);
                    getReq.onerror = () => res(null);
                } catch (err) { res(null); }
            };
            req.onerror = () => res(null);
        });
    }

    window.onload = async () => {
        addLog("🚀 Khởi tạo hệ thống...");
        
        // Load API Key
        const settingsDb = await initSettingsDB();
        const txSettings = settingsDb.transaction(SETTINGS_STORE_NAME, 'readonly');
        const settingsStore = txSettings.objectStore(SETTINGS_STORE_NAME);
        const reqSettings = settingsStore.get('api_key');
        reqSettings.onsuccess = () => { 
            if(reqSettings.result) { 
                apiKeyInput.value = reqSettings.result; 
                addLog("🔑 Đã nạp API Key."); 
            }
        };

        // Load data from MediaCacheDB
        addLog("🔍 Truy xuất dữ liệu từ MediaCacheDB...");
        const data = await loadDataFromCache();
        if (data) {
            scriptInput.value = data.paragraph || "";
            if (data.blob) {
                currentBlob = data.blob;
                audioPreview.src = URL.createObjectURL(data.blob);
                audioPreview.style.display = "block";
                addLog("🎵 Đã nạp Audio & Script tự động.");
            }
        } else {
            addLog("⚠️ Không tìm thấy dữ liệu trong MediaCacheDB.");
        }
    };

    apiKeyInput.onchange = async () => {
        const val = apiKeyInput.value.trim();
        const db = await initSettingsDB();
        const tx = db.transaction(SETTINGS_STORE_NAME, 'readwrite');
        tx.objectStore(SETTINGS_STORE_NAME).put(val, 'api_key');
        addLog("🔑 Đã cập nhật API Key.");
    };

    audioInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            currentBlob = file;
            audioPreview.src = URL.createObjectURL(file);
            audioPreview.style.display = "block";
            addLog(`📂 Đã chọn file: ${file.name}`);
        }
    };

    analyzeBtn.onclick = async () => {
        const key = apiKeyInput.value.trim();
        const script = scriptInput.value.trim();
        const file = currentBlob;

        if(!file || !key) {
            alert("Vui lòng cung cấp API Key và Audio!");
            return;
        }

        analyzeBtn.disabled = true;
        statusDiv.innerText = "Trạng thái: Đang phân tích...";
        resultDiv.style.display = "none";
        addLog("⏳ Bắt đầu quá trình phân tích...");

        try {
            const base64Data = await new Promise((resolve) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result.split(',')[1]);
                r.readAsDataURL(file);
            });

			const models = ['gemini-2.5-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-flash'];
            let responseData = null;
            let lastError = "";

            for (let modelName of models) {
                addLog(`🔄 Đang thử sử dụng model: ${modelName}...`);
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;

                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [
                                { text: `Bạn là chuyên gia ngôn ngữ Nhật Bản. Dưới đây là kịch bản gốc và file ghi âm thực tế. Hãy thực hiện các yêu cầu sau bằng TIẾNG VIỆT:
                                    KỊCH BẢN GỐC: "${script || 'Không cung cấp - Hãy tự nhận diện nội dung'}"
                                    YÊU CẦU:
                                    1. SO SÁNH: Đối chiếu giữa kịch bản gốc và những gì người nói thực tế đã nói. Chỉ ra các từ bị nói sai, nói thiếu hoặc biến âm.
                                    2. NHẬN XÉT CHI TIẾT: Phân tích về phát âm (seion, dakuon, youon...), trường âm (chouon), âm ngắt (sokuon) và đặc biệt là Pitch Accent.
                                    3. CHẤM ĐIỂM: Đưa ra điểm số trên thang điểm 1000 dựa trên độ chính xác, ngữ điệu và sự tự nhiên (Ví dụ: 850/1000) và lý do tại sao đưa ra con số điểm đó.
                                    4. KHUYÊN CẢI THIỆN: Đưa ra 2-3 lời khuyên thực tế để nói tốt hơn.
                                    Sử dụng định dạng Markdown (tiêu đề, danh sách, bảng) để trình bày rõ ràng.` },
                                { inline_data: { mime_type: file.type || "audio/mp4", data: base64Data } }
                            ]}]
                        })
                    });

                    responseData = await response.json();
                    if (responseData.error) {
                        lastError = responseData.error.message;
                        addLog(`⚠️ Model ${modelName} báo lỗi: ${lastError}`);
                        continue;
                    }
                    
                    if (responseData.candidates) {
                        addLog(`✅ Thành công với model: ${modelName}`);
                        break;
                    }
                } catch (e) {
                    lastError = e.message;
                    addLog(`❗ Lỗi kết nối tới ${modelName}: ${e.message}`);
                }
            }

            if (!responseData || responseData.error) throw new Error(lastError || "Không thể kết nối tới bất kỳ Model nào.");

            if (responseData.candidates && responseData.candidates[0].content.parts[0].text) {
                const aiText = responseData.candidates[0].content.parts[0].text;
                
                resultDiv.innerHTML = marked.parse(aiText);
                resultDiv.style.display = "block";
                statusDiv.innerText = "Trạng thái: Hoàn tất!";
                addLog("✅ Đã nhận và hiển thị kết quả.");

                const fileIdFromUrl = new URLSearchParams(window.location.search).get('fileId');
                if (fileIdFromUrl) {
                    addLog("📡 Đang đồng bộ điểm số...");
                    const scoreMatch = aiText.match(/(\d+)\/1000/);
                    const scoreValue = scoreMatch ? scoreMatch[1] : "0";

                    fetch(WEB_APP_URL, {
                        method: 'POST',
                        mode: 'no-cors',
                        body: JSON.stringify({
                            action: 'updateAssessment',
                            fileId: fileIdFromUrl,
                            score: scoreValue,
                            feedback: aiText
                        })
                    });
                    addLog("📊 Đã gửi yêu cầu lưu điểm thành công.");
                }
            } else {
                throw new Error("Không nhận được phản hồi từ AI.");
            }
        } catch (err) {
            addLog("❌ Lỗi: " + err.message);
            statusDiv.innerText = "Trạng thái: Lỗi.";
            resultDiv.innerText = "Lỗi: " + err.message;
            resultDiv.style.display = "block";
        } finally {
            analyzeBtn.disabled = false;
        }
    };
</script>
</body>
</html>
