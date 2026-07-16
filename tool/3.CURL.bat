#!/bin/bash

# Kiểm tra xem file output.txt có tồn tại không
if [ ! -f "output.txt" ]; then
    echo "Lỗi: Không tìm thấy file output.txt"
    exit 1
fi

# Đọc nội dung file vào biến
FILE_CONTENT=$(cat output.txt)

# Thực hiện curl và lưu kết quả vào output2.json
curl 'https://hvdic.thivien.net/transcript-query.json.php' \
  -H 'Accept: application/json, text/javascript, */*; q=0.01' \
  -H 'Accept-Language: en-US,en;q=0.9,ja;q=0.8' \
  -H 'Cache-Control: no-cache' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8' \
  -b 'chromeext=0; no_vnkb=1; PHPSESSID=a3b5a83d6b2695becb5169d64e054fde; _gid=GA1.2.1747709806.1784192035; _gat=1; _ga=GA1.1.339178944.1781426201; _ga_KST14CR5EV=GS2.2.s1784194136$o6$g0$t1784194136$j60$l0$h0; __gads=ID=e9503e2f07cfe292:T=1781426201:RT=1784194136:S=ALNI_MZMdglujauGzmSqW0uAg37c7OhlMw; __gpi=UID=0000146a2343589e:T=1781426201:RT=1784194136:S=ALNI_MYtihIM2MoXlsdTycC_LIksMr5a9w; __eoi=ID=f6e95369ce250687:T=1781426201:RT=1784194136:S=AA-Afjae_yHsX3QMZsQlWJFb0Uce; _ga_S77X7GFNH7=GS2.1.s1784194136$o6$g0$t1784194137$j59$l0$h0; FCCDCF=%5Bnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B%5B32%2C%22%5B%5C%22796a457f-5817-46d9-8c27-2d3367d15b40%5C%22%2C%5B1781426203%2C33000000%5D%5D%22%5D%5D%5D; FCNEC=%5B%5B%22AKsRol9LZA6pW0kyPyGuyw7MpB79eaFPoJMrAPgNSRD3zwMyXui6WVAo3K4NFF5Fpc3lWXgLE_KNX1c_WauG6XDoUPRlMefCJw70cdlO_H3yeeYcgo7gpGo56nI2YIsxOPScAgBmEZUJD2SygGVEvsP1PUCkAVrLcQ%3D%3D%22%5D%5D' \
  -H 'Origin: https://hvdic.thivien.net' \
  -H 'Pragma: no-cache' \
  -H 'Referer: https://hvdic.thivien.net/transcript.php' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-origin' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/150.0.0.0' \
  -H 'X-Requested-With: XMLHttpRequest' \
  -H 'sec-ch-ua: "Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "Windows"' \
  --data-urlencode "mode=trans" \
  --data-urlencode "lang=1" \
  --data-urlencode "capitalize=1" \
  --data-urlencode "input=$FILE_CONTENT" > output2.json

echo "Đã lưu kết quả vào file output2.json"