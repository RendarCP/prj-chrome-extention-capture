import React, { useState, useEffect, useRef } from "react";
import "../styles/Editor.css";

const Editor: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Chrome Storage에서 스크린샷 데이터 가져오기
    chrome.storage.local.get(["currentScreenshot"], (result) => {
      if (result.currentScreenshot) {
        setImage(result.currentScreenshot);
      }
    });
  }, []);

  const handleImageClick = () => {
    setIsZoomed(!isZoomed);
  };

  if (!image) {
    return <div>이미지를 불러오는 중...</div>;
  }

  return (
    <div className="editor-container">
      <h1>스크린샷 편집기</h1>
      <div
        className="editor-content"
        style={{
          overflow: isZoomed ? "auto" : "hidden",
          height: "calc(100vh - 100px)",
        }}
      >
        <img
          ref={imgRef}
          src={image}
          alt="스크린샷"
          onClick={handleImageClick}
          style={{
            width: isZoomed ? "auto" : "100%",
            height: isZoomed ? "auto" : "100%",
            objectFit: isZoomed ? "none" : "contain",
            cursor: isZoomed ? "zoom-out" : "zoom-in",
            transition: "all 0.3s ease-out",
          }}
        />
      </div>
    </div>
  );
};

export default Editor;
