/**
 * Shadowing Game Module
 * Chức năng: Nhận diện giọng nói, Highlight real-time, Chấm điểm Levenshtein
 */
export const ShadowGame = (() => {
  let recognition = null;
  let isListening = false;

  // Thuật toán so khớp văn bản để tính điểm %
  const getLevenshteinScore = (s1, s2) => {
    const a = s1.replace(/[、。！？\s]/g, "").toLowerCase();
    const b = s2.replace(/[、。！？\s]/g, "").toLowerCase();
    if (!b) return 0;
    const tmp = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for(let i=0; i<=a.length; i++) tmp[0][i]=i;
    for(let j=0; j<=b.length; j++) tmp[j][0]=j;
    for(let j=1; j<=b.length; j++){
      for(let i=1; i<=a.length; i++){
        const sub = a[i-1] === b[j-1] ? 0 : 1;
        tmp[j][i] = Math.min(tmp[j][i-1]+1, tmp[j-1][i]+1, tmp[j-1][i-1]+sub);
      }
    }
    const dist = tmp[b.length][a.length];
    const max = Math.max(a.length, b.length);
    return Math.floor(((max - dist) / max) * 100);
  };

  const init = () => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Trình duyệt không hỗ trợ Speech Recognition.");
      return null;
    }
    
    recognition = new SpeechRec();
    recognition.lang = 'ja-JP';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = "", final = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      
      const gameInterim = document.getElementById('gameInterim');
      if (gameInterim) gameInterim.textContent = interim || "...";
      
      const activeArea = document.querySelector('.content-area.active:not(.vi-text)');
      if (!activeArea) return;

      const spans = activeArea.querySelectorAll('.word-span');
      const currentSpeech = (final + interim).replace(/[、。！？\s]/g, "");

      // Logic Highlight & Auto-scroll trong phạm vi 3 dòng
      spans.forEach(span => {
        if (currentSpeech.includes(span.textContent)) {
          span.classList.add('highlight');
          // Cuộn đến ký tự đang đọc nếu nó nằm ngoài khung nhìn
          span.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      });

      if (final) {
        const targetText = activeArea.innerText.replace(/[、。！？\s]/g, "");
        const score = getLevenshteinScore(targetText, final);
        const scoreEl = document.getElementById('gameScore');
        if (scoreEl) {
          scoreEl.textContent = `${score}%`;
          // Đổi màu theo thành tích
          scoreEl.style.color = score > 80 ? "#4ade80" : (score > 50 ? "#facc15" : "#f87171");
        }
      }
    };

    recognition.onend = () => { if (isListening) recognition.start(); };
    return recognition;
  };

  return {
    toggle: () => {
      if (!recognition) init();
      const panel = document.getElementById('gamePanel');
      const btn = document.getElementById('btnMic');

      if (!isListening) {
        isListening = true;
        if (panel) panel.style.display = 'flex';
        if (btn) {
          btn.classList.add('listening');
          btn.textContent = "🛑 Dừng";
        }
        recognition.start();
      } else {
        isListening = false;
        if (panel) panel.style.display = 'none';
        if (btn) {
          btn.classList.remove('listening');
          btn.textContent = "🎤 Luyện";
        }
        recognition.stop();
      }
    },
    resetUI: () => {
      const scoreEl = document.getElementById('gameScore');
      const interimEl = document.getElementById('gameInterim');
      if (scoreEl) scoreEl.textContent = "0%";
      if (interimEl) interimEl.textContent = "Sẵn sàng...";
      
      // Reset highlight cũ khi chuyển trang
      document.querySelectorAll('.word-span.highlight').forEach(s => s.classList.remove('highlight'));
    }
  };
})();