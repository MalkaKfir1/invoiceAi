import React, { useState, useEffect } from "react";
import PdfUploader from "./components/PdfUploader/PdfUploader";
import Settings from "./components/Settings/Settings";
import "./App.css";
import { improveInvoiceDataWithOpenAI } from "./components/aiHelper";

async function handleOCRResult(ocrText) {
  const apiKey = localStorage.getItem("openai_api_key");
  if (!apiKey) {
    alert("יש להכניס מפתח OpenAI בהגדרות קודם");
    return;
  }

  const aiResult = await improveInvoiceDataWithOpenAI(ocrText, apiKey);
}

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
