import React, { useState, useEffect } from "react";

function App() {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [tempScreenshot, setTempScreenshot] = useState<string | null>(null);

  useEffect(() => {
    if (tempScreenshot) {
      setScreenshot(tempScreenshot);
      setTempScreenshot(null);
    }
  }, [tempScreenshot]);

  console.log("screenshot", screenshot);

  const isRestrictedUrl = (url: string) => {
    return (
      url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("chrome.google.com/webstore") ||
      url.startsWith("chrome.google.com/extensions")
    );
  };

  const captureVisibleTab = async () => {
    try {
      setError(null);
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab.id || !tab.url) return;

      if (isRestrictedUrl(tab.url)) {
        setError("이 페이지에서는 캡처할 수 없습니다.");
        return;
      }

      // 스크롤바 숨기기
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
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
        },
      });

      // 스타일이 적용될 시간을 주기 위해 잠시 대기
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 캡처 실행
      const dataUrl = await chrome.tabs.captureVisibleTab();

      // 스크롤바 복원
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const style = document.getElementById("hide-scrollbar-style");
          if (style) {
            style.remove();
          }
        },
      });

      setTempScreenshot(dataUrl);
    } catch (error) {
      console.error("스크린샷 캡처 실패:", error);
      setError("스크린샷 캡처에 실패했습니다.");
    }
  };

  const captureFullPage = async () => {
    try {
      setError(null);
      setIsCapturing(true);
      setCaptureProgress(0);

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab.id || !tab.url) {
        console.error("탭 ID 또는 URL이 없습니다.");
        return;
      }

      if (isRestrictedUrl(tab.url)) {
        setError("이 페이지에서는 캡처할 수 없습니다.");
        return;
      }

      // 스크롤바 숨기기
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
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
        },
      });

      // Content script 주입
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["contentScript.js"],
      });

      // 페이지 전체 높이와 뷰포트 크기 가져오기
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "captureFullPage",
      });
      const { fullHeight } = response;
      const viewportHeight = window.innerHeight;
      const screenshots: string[] = [];

      // 캡처 함수
      const captureScreen = async (retryCount = 0) => {
        try {
          return await chrome.tabs.captureVisibleTab();
        } catch (error: any) {
          if (
            error
              .toString()
              .includes("MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND") &&
            retryCount < 3
          ) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            return captureScreen(retryCount + 1);
          }
          throw error;
        }
      };

      // 페이지 레이아웃 고정
      await chrome.tabs.sendMessage(tab.id, {
        action: "prepareCapture",
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 페이지 최상단으로 스크롤
      await chrome.tabs.sendMessage(tab.id, {
        action: "scrollTo",
        position: 0,
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 첫 번째 캡처
      const firstScreenshot = await captureScreen();
      screenshots.push(firstScreenshot);

      // fixed 요소 숨기기
      await chrome.tabs.sendMessage(tab.id, {
        action: "hideFixedElements",
      });

      // 스크롤하면서 캡처
      let currentPosition = viewportHeight;
      let lastScrollPosition = 0;

      while (currentPosition <= fullHeight) {
        try {
          // 스크롤
          await chrome.tabs.sendMessage(tab.id, {
            action: "scrollTo",
            position: currentPosition,
          });

          // 스크롤 안정화 대기
          await new Promise((resolve) => setTimeout(resolve, 100));

          // 현재 스크롤 위치 확인
          const response = await chrome.tabs.sendMessage(tab.id, {
            action: "getScrollPosition",
          });

          // 스크롤이 더 이상 되지 않으면 종료
          if (response.scrollPosition === lastScrollPosition) {
            break;
          }
          lastScrollPosition = response.scrollPosition;

          // 캡처
          const screenshot = await captureScreen();
          screenshots.push(screenshot);

          // 진행률 업데이트
          const progress = Math.min(
            Math.round((currentPosition / fullHeight) * 100),
            100
          );
          setCaptureProgress(progress);

          // 다음 위치로 이동
          currentPosition += viewportHeight;
        } catch (error) {
          console.error("캡처 중 에러 발생:", error);
          setError("캡처 중 오류가 발생했습니다. 다시 시도해주세요.");
          break;
        }
      }

      // fixed 요소 다시 보이기
      await chrome.tabs.sendMessage(tab.id, {
        action: "showFixedElements",
      });

      // 원본 스타일 복원
      await chrome.tabs.sendMessage(tab.id, {
        action: "restoreStyles",
      });

      // 이미지 합치기
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("캔버스 컨텍스트를 가져올 수 없습니다.");

      const firstImage = await new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = screenshots[0];
      });

      canvas.width = firstImage.width;
      canvas.height = fullHeight;

      // 이미지 순차적으로 합치기
      let y = 0;
      for (let i = 0; i < screenshots.length; i++) {
        const img = await new Promise<HTMLImageElement>((resolve) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.src = screenshots[i];
        });

        if (i === screenshots.length - 1) {
          // 마지막 이미지는 남은 영역만큼만 사용
          const remainingHeight = fullHeight - y;
          if (remainingHeight > 0) {
            context.drawImage(
              img,
              0,
              img.height - remainingHeight, // 이미지의 아래쪽 부분만 사용
              img.width,
              remainingHeight,
              0,
              y,
              img.width,
              remainingHeight
            );
          }
        } else {
          context.drawImage(
            img,
            0,
            0,
            img.width,
            viewportHeight,
            0,
            y,
            img.width,
            viewportHeight
          );
          y += viewportHeight;
        }
      }

      // 캡처 완료 후 스크롤바 복원
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const style = document.getElementById("hide-scrollbar-style");
          if (style) {
            style.remove();
          }
        },
      });

      const finalImage = canvas.toDataURL();
      setTempScreenshot(finalImage);
    } catch (error) {
      console.error("전체 페이지 캡처 실패:", error);
      setError("전체 페이지 캡처에 실패했습니다.");
    } finally {
      setIsCapturing(false);
      setCaptureProgress(0);
    }
  };

  const openEditor = async () => {
    if (screenshot) {
      try {
        // 스크린샷 데이터를 Chrome Storage에 저장
        await chrome.storage.local.set({ currentScreenshot: screenshot });

        // 편집기 URL 생성 (스크린샷 데이터 없이)
        const editorUrl = chrome.runtime.getURL("editor.html");
        console.log("편집 페이지 URL:", editorUrl);

        // 새 탭에서 편집기 열기
        chrome.tabs.create({ url: editorUrl });
      } catch (error) {
        console.error("스크린샷 저장 실패:", error);
        setError("스크린샷 저장에 실패했습니다.");
      }
    } else {
      console.error("screenshot이 null입니다");
    }
  };

  return (
    <div className="App" style={{ width: "400px", padding: "20px" }}>
      <h1 style={{ fontSize: "20px", marginBottom: "20px" }}>스크린샷 캡처</h1>
      {error && (
        <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>
      )}
      {!screenshot ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            onClick={captureVisibleTab}
            style={{
              padding: "10px",
              fontSize: "14px",
              cursor: "pointer",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
            }}
          >
            현재 화면 캡처
          </button>
          <button
            onClick={captureFullPage}
            disabled={isCapturing}
            style={{
              padding: "10px",
              fontSize: "14px",
              cursor: isCapturing ? "not-allowed" : "pointer",
              backgroundColor: isCapturing ? "#cccccc" : "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "4px",
            }}
          >
            {isCapturing
              ? `캡처 중... ${captureProgress}%`
              : "전체 페이지 캡처"}
          </button>
          {isCapturing && (
            <div style={{ marginTop: "10px" }}>
              <div
                style={{
                  width: "100%",
                  height: "4px",
                  backgroundColor: "#f0f0f0",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${captureProgress}%`,
                    height: "100%",
                    backgroundColor: "#2196F3",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <img
            src={screenshot}
            alt="캡처된 화면"
            style={{
              maxWidth: "100%",
              marginBottom: "10px",
              borderRadius: "4px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          />
          <button
            onClick={openEditor}
            style={{
              padding: "10px",
              fontSize: "14px",
              cursor: "pointer",
              backgroundColor: "#FF9800",
              color: "white",
              border: "none",
              borderRadius: "4px",
            }}
          >
            편집하기
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
