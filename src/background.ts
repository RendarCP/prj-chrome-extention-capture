chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "capture") {
    // 캡처 전에 스크롤바 숨기기
    chrome.scripting
      .executeScript({
        target: { tabId: request.tabId },
        func: hideScrollbars,
      })
      .then(() => {
        // 스크롤바가 숨겨진 후 캡처 실행
        setTimeout(() => {
          chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
            // 캡처 완료 후 스크롤바 복원
            chrome.scripting.executeScript({
              target: { tabId: request.tabId },
              func: showScrollbars,
            });

            // 캡처된 이미지 저장
            chrome.storage.local.set({ currentScreenshot: dataUrl }, () => {
              sendResponse({ success: true });
            });
          });
        }, 100); // 스크롤바가 사라지는 것을 기다리기 위한 짧은 지연
      });
    return true;
  }
});

// 스크롤바 숨기기 함수
function hideScrollbars() {
  const style = document.createElement("style");
  style.id = "hide-scrollbar-style";
  style.textContent = `
    ::-webkit-scrollbar {
      display: none !important;
    }
    * {
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }
    body {
      overflow: -moz-scrollbars-none !important;
    }
  `;
  document.head.appendChild(style);
}

// 스크롤바 복원 함수
function showScrollbars() {
  const style = document.getElementById("hide-scrollbar-style");
  if (style) {
    style.remove();
  }
}
