chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "setScreenshot") {
    // 메시지를 특정 탭으로만 전달
    if (message.targetTabId) {
      chrome.tabs.sendMessage(message.targetTabId, message);
    }
  }
});
