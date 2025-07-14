import React, { useState, useEffect } from "react";
import PdfUploader from "./components/PdfUploader/PdfUploader";
import Settings from "./components/Settings/Settings";
import FileUpload from "./components/FileUpload/FileUpload";

import "./App.css";

const App = () => {
  const [openAIKey, setOpenAIKey] = useState(
    localStorage.getItem("openAIKey") || ""
  );
  const [azureOpenAIKey, setAzureOpenAIKey] = useState(
    localStorage.getItem("azureOpenAIKey") || ""
  );
  // localStorage- מאפשר לשמור את המפתחות הללו כך שהמשתמש לא יצטרך להכניס אותם כל פעם מחדש.

  const [showSettings, setShowSettings] = useState(false);

  const toggleSettings = () => setShowSettings(true);

  // פונקציה שתופסת את הקבצים ומבצע עליהם עיבוד

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
          {/* // קומפוננטה של הגרירת קובץ וחילוץ הנתונים מהקובץ */}
          <FileUpload />

          {/*  קומפוננטה של בחירת קובץ וחילוץ הנתונים*/}
          <PdfUploader openAIKey={openAIKey} azureOpenAIKey={azureOpenAIKey} />
        </div>
      )}
    </div>
  );
};

export default App;
