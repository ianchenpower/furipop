# FuriPop - X (Twitter) 日文假名懸停助手 ✨

專為 X (Twitter) 設計的輕量日文假名懸停外掛。不破壞原生推文排版，滑鼠移至日文漢字/詞彙上方時即刻浮現平假名讀音。

---

## 🎯 產品特色

- **零破版設計**：採用懸停（Hover）氣泡機制，不強行插入 `<ruby>` 撐開推特行距。
- **針對 X (Twitter) 深度優化**：利用 MutationObserver + Debounce 監聽動態推文流，滑動不卡頓、不與 React Virtual DOM 衝突。
- **次文化與常用詞支援**：內建推特、動漫、繪師常用詞彙與網路迷因（如「野獣先輩」、「神絵師」、「草」、「推し」等）。
- **輕量與隱私優先**：純本地解析，不向任何外部伺服器發送使用者瀏覽資料。

---

## 📂 專案結構

```
furipop/
├── manifest.json       # Chrome Extension Manifest V3 設定檔
├── popup/              # 點擊擴充功能圖示彈出的控制面板
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/            # 注入至 X (Twitter) 頁面的核心腳本
│   ├── content.js      # 推文監聽、分詞匹配與節點處理
│   └── content.css     # 懸停氣泡樣式與微動畫
├── icons/              # 外掛圖示 (16x16, 48x48, 128x128)
├── .gitignore
└── README.md
```

---

## 🛠️ 開發與載入方式

1. 開啟 Chrome 瀏覽器，網址輸入：`chrome://extensions/`
2. 開啟右上角 **「開發人員模式」（Developer mode）**。
3. 點擊 **「載入未封裝項目」（Load unpacked）**。
4. 選取本專案根目錄資料夾即可。
5. 前往 [x.com](https://x.com) 測試懸停標音效果。

---

## 🗺️ 開發路線圖 (Roadmap)

- [x] **v0.1.0 (MVP)**：X (Twitter) 推文文字監聽 + 基礎懸停氣泡 + 內建常用/迷因詞庫
- [ ] **v0.2.0**：整合 Kuromoji.js / WASM 完整辭典，支援全日語漢字形態素分析
- [ ] **v0.3.0**：支援 YouTube CC 字幕懸停 / 浮動標音層
- [ ] **v0.4.0**：羅馬拼音 (Romaji) 切換開關與 Anki / 單字卡一鍵匯出
