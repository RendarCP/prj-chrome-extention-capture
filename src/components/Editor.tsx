import React, { useState, useEffect } from "react";

const Editor: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    // Chrome Storage에서 스크린샷 데이터 가져오기
    chrome.storage.local.get(["currentScreenshot"], (result) => {
      if (result.currentScreenshot) {
        setImage(result.currentScreenshot);
      }
    });
  }, []);

  if (!image) {
    return <div>이미지를 불러오는 중...</div>;
  }

  return (
    <div className="editor-container">
      <h1>스크린샷 편집기</h1>
      <div className="editor-content">
        <img src={image} alt="스크린샷" />
        {/* 여기에 편집 도구들 추가 */}
      </div>
    </div>
  );
};

export default Editor;
