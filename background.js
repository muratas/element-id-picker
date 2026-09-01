// アイコンクリックでタブごとにピッカーのON/OFFを切り替える。
// 状態はタブごとに service worker のメモリ上で保持し、切り替えを content script に伝える。

const activeTabs = new Set();

function updateBadge(tabId, isActive) {
  chrome.action.setBadgeText({ tabId, text: isActive ? "ON" : "" });
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#2563eb" });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  const nextActive = !activeTabs.has(tab.id);
  if (nextActive) {
    activeTabs.add(tab.id);
  } else {
    activeTabs.delete(tab.id);
  }

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: "EIP_TOGGLE_PICKER",
      active: nextActive,
    });
  } catch (err) {
    // content script が未注入のページ（chrome:// など）では失敗するので無視する。
    console.warn("Element ID Picker: failed to toggle on this tab", err);
  }

  updateBadge(tab.id, nextActive);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabs.delete(tabId);
});

// content script 側で Escape キーが押されて自主的にOFFになった場合、
// バッジと内部状態をそれに合わせる。
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "EIP_FORCE_OFF" && sender.tab?.id != null) {
    activeTabs.delete(sender.tab.id);
    updateBadge(sender.tab.id, false);
  }
});

// ページ遷移（リロード等）でピッカー状態がリセットされるため、バッジも合わせてリセットする。
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading" && activeTabs.has(tabId)) {
    activeTabs.delete(tabId);
    updateBadge(tabId, false);
  }
});
