document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggle-enabled");
  const statusText = document.getElementById("status-text");
  let savedEnabled = true;
  toggle.disabled = true;

  // 讀取設定
  chrome.storage.sync.get({ furipopEnabled: true }, (items) => {
    if (chrome.runtime.lastError) {
      statusText.textContent = "無法讀取設定，請重新開啟";
      statusText.style.color = "#c0392b";
      return;
    }
    savedEnabled = items.furipopEnabled;
    toggle.checked = savedEnabled;
    updateStatus(savedEnabled);
    toggle.disabled = false;
  });

  // 監聽變更
  toggle.addEventListener("change", (e) => {
    const isEnabled = e.target.checked;
    toggle.disabled = true;
    chrome.storage.sync.set({ furipopEnabled: isEnabled }, () => {
      if (chrome.runtime.lastError) {
        toggle.checked = savedEnabled;
        statusText.textContent = "設定儲存失敗，請重試";
        statusText.style.color = "#c0392b";
        toggle.disabled = false;
        return;
      }
      savedEnabled = isEnabled;
      toggle.disabled = false;
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
      statusText.textContent = "讀音助手已啟用";
      statusText.style.color = "#00ba7c";
    } else {
      statusText.textContent = "外掛已暫停";
      statusText.style.color = "#71767b";
    }
  }
});

document.getElementById('open-dictionary').addEventListener('click',()=>chrome.runtime.openOptionsPage());
