interface OriginalStyle {
  display?: string;
  position: string;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  width?: string;
  height?: string;
  margin?: string;
  transform?: string;
  zIndex?: string;
  minWidth?: string;
  minHeight?: string;
  inset?: string;
  visibility?: string;
  overflow?: string;
}

interface MessageResponse {
  success: boolean;
  fullHeight?: number;
  error?: string;
  loaded?: boolean;
  scrollPosition?: number;
}

chrome.runtime.onMessage.addListener(
  (
    request: { action: string; position?: number },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => {
    const originalStyles = new Map<HTMLElement, OriginalStyle>();
    let originalBodyStyle: OriginalStyle | null = null;

    if (request.action === "captureFullPage") {
      const fullHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      );
      sendResponse({ success: true, fullHeight });
    } else if (request.action === "prepareCapture") {
      try {
        // 현재 스크롤 위치 저장
        const currentScroll =
          window.pageYOffset || document.documentElement.scrollTop;

        // body 스타일 저장 및 설정
        const bodyComputedStyle = window.getComputedStyle(document.body);
        originalBodyStyle = {
          position: bodyComputedStyle.position || "static",
          minWidth: bodyComputedStyle.minWidth,
          minHeight: bodyComputedStyle.minHeight,
          display: bodyComputedStyle.display,
          top: bodyComputedStyle.top,
          left: bodyComputedStyle.left,
          right: bodyComputedStyle.right,
          bottom: bodyComputedStyle.bottom,
          width: bodyComputedStyle.width,
          height: bodyComputedStyle.height,
          margin: bodyComputedStyle.margin,
          transform: bodyComputedStyle.transform,
          zIndex: bodyComputedStyle.zIndex,
        };

        // body 스타일 설정
        document.body.style.cssText += `
        position: relative !important;
        min-width: 100vw !important;
        min-height: 100vh !important;
      `;

        // 고정된 요소들 찾기 (fixed, sticky)
        const stickyElements = Array.from(
          document.querySelectorAll("*")
        ).filter((el) => {
          const style = getComputedStyle(el);
          return style.position === "sticky";
        });

        const fixedElements = document.querySelectorAll<HTMLElement>(
          'header, nav, .fixed, [style*="position: fixed"], [style*="position:fixed"]'
        );

        // sticky 요소 처리
        stickyElements.forEach((element) => {
          const computedStyle = window.getComputedStyle(element);
          originalStyles.set(element as HTMLElement, {
            position: computedStyle.position,
            inset: computedStyle.inset,
          });

          (element as HTMLElement).style.cssText = `
            position: relative !important;
            inset: auto !important;
          `;
        });

        // 5초 후 자동으로 스타일 복원
        setTimeout(() => {
          originalStyles.forEach((styles, element) => {
            element.style.position = styles.position || "";
            element.style.inset = styles.inset || "";
          });
          originalStyles.clear();
        }, 5000);

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
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } else if (
      request.action === "scrollTo" &&
      typeof request.position === "number"
    ) {
      try {
        window.scrollTo({
          top: request.position,
          behavior: "instant",
        });
        sendResponse({ success: true });
      } catch (error) {
        console.error("Error in scrollTo:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } else if (request.action === "restoreStyles") {
      try {
        // 저장된 스타일 복원
        originalStyles.forEach((styles, element) => {
          // 모든 important 스타일 제거
          element.style.cssText = "";

          // 원본 스타일 복원
          Object.entries(styles).forEach(([property, value]) => {
            if (value && value !== "auto") {
              element.style.setProperty(property, value, "");
            }
          });
        });
        originalStyles.clear();

        // body 스타일 복원
        if (originalBodyStyle) {
          document.body.style.position = originalBodyStyle.position;
          document.body.style.minWidth = originalBodyStyle.minWidth || "";
          document.body.style.minHeight = originalBodyStyle.minHeight || "";
        }

        // 스크롤 설정 복원
        document.documentElement.style.removeProperty("scroll-behavior");
        document.body.style.removeProperty("overflow");
        document.documentElement.style.removeProperty("overflow");

        sendResponse({ success: true });
      } catch (error) {
        console.error("Error in restoreStyles:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } else if (request.action === "getScrollPosition") {
      const scrollPosition =
        window.pageYOffset || document.documentElement.scrollTop;
      sendResponse({ success: true, scrollPosition });
    } else if (request.action === "checkPageLoad") {
      const checkLoad = () => {
        return new Promise<boolean>((resolve) => {
          if (document.readyState === "complete") {
            const images = document.getElementsByTagName("img");
            const imagePromises = Array.from(images).map(
              (img) =>
                new Promise<boolean>((resolve) => {
                  if (img.complete) {
                    resolve(true);
                  } else {
                    img.onload = () => resolve(true);
                    img.onerror = () => resolve(true);
                  }
                })
            );

            Promise.all(imagePromises).then(() => {
              resolve(true);
            });
          } else {
            window.addEventListener("load", () => {
              resolve(true);
            });
          }
        });
      };

      checkLoad().then(() => {
        sendResponse({ success: true, loaded: true });
      });
      return true;
    } else if (request.action === "hideNavigation") {
      // nav와 header 태그 숨기기
      const navElements = document.querySelectorAll("nav, header");
      navElements.forEach((element) => {
        (element as HTMLElement).style.display = "none";
      });
      sendResponse({ success: true });
    } else if (request.action === "showNavigation") {
      // nav와 header 태그 다시 보이기
      const navElements = document.querySelectorAll("nav, header");
      navElements.forEach((element) => {
        (element as HTMLElement).style.display = "";
      });
      sendResponse({ success: true });
    } else if (request.action === "hideFixedElements") {
      try {
        const fixedElements = Array.from(document.querySelectorAll("*")).filter(
          (el) => {
            const style = getComputedStyle(el);
            return style.position === "fixed";
          }
        );

        fixedElements.forEach((element) => {
          const el = element as HTMLElement;
          const computedStyle = window.getComputedStyle(el);

          // 원본 스타일 저장
          originalStyles.set(el, {
            visibility: computedStyle.visibility,
            overflow: computedStyle.overflow,
          });

          // fixed 요소 숨기기
          el.style.cssText = `
            visibility: hidden !important;
            overflow: hidden !important;
          `;
        });

        sendResponse({ success: true });
      } catch (error) {
        console.error("Error in hideFixedElements:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } else if (request.action === "showFixedElements") {
      try {
        originalStyles.forEach((styles, element) => {
          element.style.visibility = styles.visibility || "";
          element.style.overflow = styles.overflow || "";
        });
        originalStyles.clear();

        sendResponse({ success: true });
      } catch (error) {
        console.error("Error in showFixedElements:", error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    return true;
  }
);
