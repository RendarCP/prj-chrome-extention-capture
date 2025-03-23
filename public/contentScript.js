chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const originalStyles = new Map();

  if (request.action === "captureFullPage") {
    const fullHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    );
    sendResponse({ fullHeight });
  } else if (request.action === "prepareCapture") {
    try {
      // 현재 스크롤 위치 저장
      const currentScroll =
        window.pageYOffset || document.documentElement.scrollTop;

      // 고정된 요소들 찾기 (fixed, sticky)
      const fixedElements = document.querySelectorAll(
        'header, nav, .fixed, .sticky, [style*="position: fixed"], [style*="position:fixed"], [style*="position: sticky"], [style*="position:sticky"]'
      );

      fixedElements.forEach((element) => {
        if (element instanceof HTMLElement) {
          const computedStyle = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();

          // 원본 스타일 저장 (computed style 기준)
          originalStyles.set(element, {
            display: computedStyle.display,
            position: computedStyle.position,
            top: computedStyle.top,
            left: computedStyle.left,
            right: computedStyle.right,
            bottom: computedStyle.bottom,
            width: computedStyle.width,
            height: computedStyle.height,
            margin: computedStyle.margin,
            transform: computedStyle.transform,
            zIndex: computedStyle.zIndex,
          });

          // fixed 요소의 절대 위치 계산
          let absoluteTop = rect.top;
          if (computedStyle.position === "fixed") {
            absoluteTop += currentScroll;
          }

          // 요소를 현재 위치에 고정
          element.style.cssText = `
            position: absolute !important;
            top: ${absoluteTop}px !important;
            left: ${rect.left}px !important;
            width: ${rect.width}px !important;
            height: ${rect.height}px !important;
            margin: 0 !important;
            transform: none !important;
            z-index: ${computedStyle.zIndex} !important;
          `;
        }
      });

      // 스크롤 설정
      document.documentElement.style.setProperty(
        "scroll-behavior",
        "auto",
        "important"
      );
      document.body.style.setProperty("overflow", "visible", "important");
      document.documentElement.style.setProperty(
        "overflow",
        "visible",
        "important"
      );

      sendResponse({ success: true });
    } catch (error) {
      console.error("Error in prepareCapture:", error);
      sendResponse({ success: false, error: error.message });
    }
  } else if (request.action === "scrollTo") {
    try {
      window.scrollTo({
        top: request.position,
        behavior: "instant",
      });
      sendResponse({ success: true });
    } catch (error) {
      console.error("Error in scrollTo:", error);
      sendResponse({ success: false, error: error.message });
    }
  } else if (request.action === "restoreStyles") {
    try {
      // 저장된 스타일 복원
      for (const [element, styles] of originalStyles.entries()) {
        if (element instanceof HTMLElement) {
          // 모든 important 스타일 제거
          element.style.cssText = "";

          // 원본 스타일 복원
          Object.entries(styles).forEach(([property, value]) => {
            if (value && value !== "auto") {
              element.style.setProperty(property, value, "");
            }
          });
        }
      }
      originalStyles.clear();

      // 스크롤 설정 복원
      document.documentElement.style.removeProperty("scroll-behavior");
      document.body.style.removeProperty("overflow");
      document.documentElement.style.removeProperty("overflow");

      sendResponse({ success: true });
    } catch (error) {
      console.error("Error in restoreStyles:", error);
      sendResponse({ success: false, error: error.message });
    }
  } else if (request.action === "hideNavigation") {
    // 고정된 요소들 숨기기
    const elements = document.querySelectorAll(
      'header, nav, .fixed, .sticky, [style*="position: fixed"], [style*="position:fixed"]'
    );
    elements.forEach((el) => {
      if (el instanceof HTMLElement) {
        el.style.display = "none";
      }
    });
    sendResponse({ success: true });
  } else if (request.action === "showNavigation") {
    // 숨긴 요소들 다시 보이기
    const elements = document.querySelectorAll(
      'header, nav, .fixed, .sticky, [style*="position: fixed"], [style*="position:fixed"]'
    );
    elements.forEach((el) => {
      if (el instanceof HTMLElement) {
        el.style.display = "";
      }
    });
    sendResponse({ success: true });
  }
  return true;
});
