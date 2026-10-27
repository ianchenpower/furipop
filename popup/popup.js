document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggle-enabled");
  const statusText = document.getElementById("status-text");

  // 讀取設定
  chrome.storage.sync.get({ furipopEnabled: true }, (items) => {
    toggle.checked = items.furipopEnabled;
    updateStatus(items.furipopEnabled);
  });

  // 監聽變更
  toggle.addEventListener("change", (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.sync.set({ furipopEnabled: isEnabled }, () => {
      updateStatus(isEnabled);
      // 通知目前開啟的 X 分頁更新狀態
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "FURIPOP_TOGGLE",
            enabled: isEnabled,
          }).catch(() => {
            // 忽略未注入頁面的錯誤
          });
        }
      });
    });
  });

  function updateStatus(enabled) {
    if (enabled) {
      statusText.textContent = "已在 X (Twitter) 就緒";
      statusText.style.color = "#00ba7c";
    } else {
      statusText.textContent = "外掛已暫停";
      statusText.style.color = "#71767b";
    }
  }
});
