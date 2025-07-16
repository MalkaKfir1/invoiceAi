import React, { useState, useEffect } from "react";
import PdfUploader from "./components/PdfUploader/PdfUploader";
import Settings from "./components/Settings/Settings";
import "./App.css";

const App = () => {
  const [openAIKey, setOpenAIKey] = useState(
    localStorage.getItem("openAIKey") || ""
  );
  const [azureOpenAIKey, setAzureOpenAIKey] = useState(
    localStorage.getItem("azureOpenAIKey") || ""
  );
  const [showSettings, setShowSettings] = useState(false);
  const toggleSettings = () => setShowSettings(true);
  return (
    <div className="app-container">
      <h1 className="app-header">Invoice OCR App</h1>
      <p className="app-subheader">שלח חשבוניות וקבל את הנתונים במהירות</p>

      {showSettings ? (
        <Settings
          setOpenAIKey={setOpenAIKey}
          setAzureOpenAIKey={setAzureOpenAIKey}
        />
      ) : (
        <div className="content-container">
          <button className="settings-button" onClick={toggleSettings}>
            הגדרות API
          </button>
          
          <PdfUploader openAIKey={openAIKey} azureOpenAIKey={azureOpenAIKey} />
        </div>
      )}
    </div>
  );
};

export default App;
