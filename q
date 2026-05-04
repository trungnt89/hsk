[1mdiff --git a/api/util.js b/api/util.js[m
[1mindex c1ce58d..d4f5ccf 100644[m
[1m--- a/api/util.js[m
[1m+++ b/api/util.js[m
[36m@@ -15,6 +15,71 @@[m [mexport async function ensureAuthenticated() {[m
     return cachedSheetsClient;[m
 }[m
 [m
[32m+[m[32m/**[m
[32m+[m[32m * Hàm ghi log vào Google Sheet (Giới hạn 100 records)[m
[32m+[m[32m */[m
[32m+[m[32mexport async function writeLog(type, content) {[m
[32m+[m[32m    const logSpreadsheetId = '1g2COnzVdo8SlqJVq5osT5hfNVfdTsXqzYp0bN1S8ZIc';[m
[32m+[m[32m    const logSheetName = 'Logs';[m
[32m+[m[32m    try {[m
[32m+[m[32m        await ensureAuthenticated();[m
[32m+[m[41m        [m
[32m+[m[32m        // Tạo format thời gian Nhật Bản: YYYY/MM/DD-HHMMSS[m
[32m+[m[32m        const now = new Date();[m
[32m+[m[32m        const formatter = new Intl.DateTimeFormat('ja-JP', {[m
[32m+[m[32m            timeZone: 'Asia/Tokyo',[m
[32m+[m[32m            year: 'numeric', month: '2-digit', day: '2-digit',[m
[32m+[m[32m            hour: '2-digit', minute: '2-digit', second: '2-digit',[m
[32m+[m[32m            hour12: false[m
[32m+[m[32m        });[m
[32m+[m[32m        const parts = formatter.formatToParts(now);[m
[32m+[m[32m        const p = {}; parts.forEach(v => p[v.type] = v.value);[m
[32m+[m[32m        const jstTime = `${p.year}/${p.month}/${p.day}-${p.hour}${p.minute}${p.second}`;[m
[32m+[m
[32m+[m[32m        const logData = [jstTime, type, content];[m
[32m+[m
[32m+[m[32m        // Kiểm tra số dòng hiện tại[m
[32m+[m[32m        const check = await cachedSheetsClient.spreadsheets.values.get({[m[41m [m
[32m+[m[32m            spreadsheetId: logSpreadsheetId,[m[41m [m
[32m+[m[32m            range: logSheetName[m[41m [m
[32m+[m[32m        });[m
[32m+[m[32m        const rows = check.data.values || [];[m
[32m+[m
[32m+[m[32m        // Nếu >= 100 record, xóa dòng đầu tiên (cũ nhất)[m
[32m+[m[32m        if (rows.length >= 100) {[m
[32m+[m[32m            const sheetRes = await cachedSheetsClient.spreadsheets.get({ spreadsheetId: logSpreadsheetId });[m
[32m+[m[32m            const sheet = sheetRes.data.sheets.find(s => s.properties.title === logSheetName);[m
[32m+[m[32m            const sheetId = sheet.properties.sheetId;[m
[32m+[m
[32m+[m[32m            await cachedSheetsClient.spreadsheets.batchUpdate({[m
[32m+[m[32m                spreadsheetId: logSpreadsheetId,[m
[32m+[m[32m                requestBody: {[m
[32m+[m[32m                    requests: [{[m
[32m+[m[32m                        deleteDimension: {[m
[32m+[m[32m                            range: {[m
[32m+[m[32m                                sheetId: sheetId,[m
[32m+[m[32m                                dimension: 'ROWS',[m
[32m+[m[32m                                startIndex: 0,[m
[32m+[m[32m                                endIndex: 1[m
[32m+[m[32m                            }[m
[32m+[m[32m                        }[m
[32m+[m[32m                    }][m
[32m+[m[32m                }[m
[32m+[m[32m            });[m
[32m+[m[32m        }[m
[32m+[m
[32m+[m[32m        // Ghi log mới[m
[32m+[m[32m        await cachedSheetsClient.spreadsheets.values.append({[m
[32m+[m[32m            spreadsheetId: logSpreadsheetId,[m
[32m+[m[32m            range: `${logSheetName}!A1`,[m
[32m+[m[32m            valueInputOption: 'USER_ENTERED',[m
[32m+[m[32m            requestBody: { values: [logData] },[m
[32m+[m[32m        });[m
[32m+[m[32m    } catch (e) {[m
[32m+[m[32m        console.error("[LOG ERR]", e.message);[m
[32m+[m[32m    }[m
[32m+[m[32m}[m
[32m+[m
 export async function handleRead(spreadsheetId, sheetName) {[m
     console.log(`[LOG] handleRead: Reading data from ${sheetName}`);[m
     const response = await cachedSheetsClient.spreadsheets.values.get({ spreadsheetId, range: sheetName });[m
