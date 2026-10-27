/**
 * FuriPop - X (Twitter) Content Script
 * 專為 X (Twitter) 設計的日文漢字懸停標音引擎
 */

(function () {
  "use strict";

  // 全域啟用狀態
  let isEnabled = true;

  // 讀取設定
  chrome.storage.sync.get({ furipopEnabled: true }, (items) => {
    isEnabled = items.furipopEnabled;
    toggleBodyClass();
  });

  // 監聽來自 popup 的即時切換開關
  chrome.runtime.onMessage.addListener((request) => {
    if (request.type === "FURIPOP_TOGGLE") {
      isEnabled = request.enabled;
      toggleBodyClass();
    }
  });

  function toggleBodyClass() {
    if (isEnabled) {
      document.body.classList.remove("furipop-disabled");
    } else {
      document.body.classList.add("furipop-disabled");
    }
  }

  // ==========================================
  // 1. 高頻/推特/動漫次文化詞典庫 (MVP 內建辭庫)
  // ==========================================
  const BUILTIN_DICT = {
    // 網路迷因 & 次文化
    "野獣先輩": "やじゅうせんぱい",
    "先輩": "せんぱい",
    "神絵師": "かみえし",
    "絵師": "えし",
    "推し": "おし",
    "尊い": "とうとい",
    "草": "くさ",
    "大草原": "だいそうげん",
    "初見": "しょけん",
    "配信": "はいしん",
    "生放送": "なまほうそう",
    "同人誌": "どうじんし",
    "同人": "どうじん",
    "進捗": "しんちょく",
    "落書き": "らくがき",
    "下書き": "したがき",
    "原稿": "げんこう",
    "鍵垢": "かぎあか",
    "本垢": "ほんあか",
    "裏垢": "うらあか",
    "神回": "かみかい",
    "最高": "さいこう",
    "感謝": "かんしゃ",
    "助かる": "たすかる",
    "圧倒的": "あっとうてき",
    "可愛い": "かわいい",
    "好き": "すき",
    "大好き": "だいすき",
    "愛してる": "あいしてる",

    // 日常高頻詞彙
    "大丈夫": "だいじょうぶ",
    "本当": "ほんとう",
    "何": "なに",
    "誰": "だれ",
    "今": "いま",
    "今日": "きょう",
    "明日": "あした",
    "昨日": "きのう",
    "時間": "じかん",
    "先生": "せんせい",
    "友達": "ともだち",
    "日本": "にほん",
    "日本語": "にほんご",
    "写真": "しゃしん",
    "動画": "どうが",
    "投稿": "とうこう",
    "返信": "へんしん",
    "固定": "こてい",
    "通知": "つうち",
    "確認": "かくにん",
    "了解": "りょうかい",
    "問題": "もんだい",
    "自身": "じしん",
    "自分": "じぶん",
    "私": "わたし",
    "僕": "ぼく",
    "俺": "おれ",
    "君": "きみ",
    "貴方": "あなた",
    "仕事": "しごと",
    "学校": "がっこう",
    "勉強": "べんきょう",
    "練習": "れんしゅう",
    "日常": "にちじょう",
    "生活": "せいかつ",
    "料理": "りょうり",
    "ご飯": "ごはん",
    "美味": "おい",
    "開始": "かいし",
    "終了": "しゅうりょう",
    "新作": "しんさく",
    "告知": "こくち",
    "記念": "きねん",
    "情報": "じょうほう",
    "解禁": "かいきん",
    "発売": "はつばい",
    "予約": "よやく",
    "限定": "げんてい",
    "無料": "むりょう",
    "有料": "ゆうりょう",
    "購入": "こうにゅう",
    "応援": "おうえん",
    "記念日": "きねんび",
  };

  // 排序詞條（長詞優先，避免「先輩」搶先匹配「野獣先輩」）
  const SORTED_KEYS = Object.keys(BUILTIN_DICT).sort((a, b) => b.length - a.length);
  // 組裝長詞優先正則
  const DICT_REGEX = new RegExp(
    SORTED_KEYS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
    "g"
  );

  // 日文漢字通用匹配區間 (CJK Unified Ideographs)
  const KANJI_REGEX = /[\u4E00-\u9FAF\u3400-\u4DBF]+/g;

  // ==========================================
  // 2. 文字節點處理 (避免破壞 React Virtual DOM)
  // ==========================================
  function processTextNode(textNode) {
    const parent = textNode.parentNode;
    if (!parent) return;

    // 避免在 input, textarea, code, 已處理節點中重複標記
    const tag = parent.nodeName.toUpperCase();
    if (
      tag === "SCRIPT" ||
      tag === "STYLE" ||
      tag === "TEXTAREA" ||
      tag === "INPUT" ||
      parent.classList.contains("furipop-ruby")
    ) {
      return;
    }

    const text = textNode.nodeValue;
    if (!text || !/[\u4E00-\u9FAF]/.test(text)) {
      return; // 沒有日文漢字，直接跳過
    }

    // 檢查是否有匹配詞彙
    let hasMatch = false;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    // 優先匹配辭庫中的特定名詞與梗
    text.replace(DICT_REGEX, (match, offset) => {
      hasMatch = true;
      // 將匹配前的純文字加入
      if (offset > lastIndex) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex, offset)));
      }

      // 建立標音 span
      const rubySpan = document.createElement("span");
      rubySpan.className = "furipop-ruby";
      rubySpan.setAttribute("data-furigana", BUILTIN_DICT[match]);
      rubySpan.textContent = match;
      fragment.appendChild(rubySpan);

      lastIndex = offset + match.length;
    });

    if (hasMatch) {
      // 加入最後剩餘文字
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      }
      parent.replaceChild(fragment, textNode);
    }
  }

  // 遞迴尋找 TextNode
  function walkTextNodes(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      processTextNode(node);
    } else if (
      node.nodeType === Node.ELEMENT_NODE &&
      !node.classList?.contains("furipop-ruby") &&
      node.getAttribute("data-furipop-done") !== "true"
    ) {
      // 只處理非連結的文字，或安全的 TweetText 區塊
      const children = Array.from(node.childNodes);
      for (const child of children) {
        walkTextNodes(child);
      }
    }
  }

  // ==========================================
  // 3. 掃描推文容器
  // ==========================================
  function scanTweets() {
    // X (Twitter) 專屬推文文字節點選取器
    const tweetElements = document.querySelectorAll(
      '[data-testid="tweetText"]:not([data-furipop-done="true"])'
    );

    tweetElements.forEach((el) => {
      el.setAttribute("data-furipop-done", "true");
      walkTextNodes(el);
    });
  }

  // 防抖處理 (Debounce 150ms)
  let debounceTimer = null;
  function debouncedScan() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      scanTweets();
    }, 150);
  }

  // ==========================================
  // 4. 動態監聽 (MutationObserver)
  // ==========================================
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const mutation of mutations) {
      // 只在有新增節點時觸發，避免自身修改觸發無限迴圈
      if (mutation.addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
    }
    if (shouldScan) {
      debouncedScan();
    }
  });

  // 開始監聽頁面載入
  function init() {
    scanTweets();
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    console.log("[FuriPop] Twitter 日文懸停助手已就緒！");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
