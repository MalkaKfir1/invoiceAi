import React, { useState, useEffect } from "react";
import Modal from "react-modal";
import "./Settings.css"; // כולל את קובץ ה-CSS

// מגדירים את ה-root של המודל (אם את משתמשת במודלים)
Modal.setAppElement("#root");

const Settings = ({ setOpenAIKey, setAzureOpenAIKey }) => {
  const [openAIKey, setOpenAIKeyLocal] = useState("");
  const [azureOpenAIKey, setAzureOpenAIKeyLocal] = useState("");
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // משתנה לטעינה

  // קריאת המפתחות מ-localStorage
  useEffect(() => {
    const storedOpenAIKey = localStorage.getItem("openAIKey");
    const storedAzureOpenAIKey = localStorage.getItem("azureOpenAIKey");

    if (storedOpenAIKey) setOpenAIKeyLocal(storedOpenAIKey);
    if (storedAzureOpenAIKey) setAzureOpenAIKeyLocal(storedAzureOpenAIKey);
  }, []);

  // פונקציה לוולידציה של המפתח (כדוגמת בדיקת אורך מפתח או תבנית ספציפית)
  const validateAPIKey = (key) => {
    return key && key.length === 8; // אורך מפתח לדוגמה (לשנות לפי הצורך)
  };

  // פונקציה לשמירה
  const handleSave = async () => {
    if (!openAIKey || !azureOpenAIKey) {
      setError("שני המפתחות חייבים להיות מלאים");
      return;
    }

    if (!validateAPIKey(openAIKey)) {
      setError("מפתח OpenAI לא תקין – חייב להכיל בדיוק 8 תווים");
      return;
    }

    if (!validateAPIKey(azureOpenAIKey)) {
      setError("מפתח OpenAI Azure  לא תקין – חייב להכיל בדיוק 8 תווים");
      
      return;
    }

    try {
      setIsLoading(true); // התחלת טעינה

      // שומר את המפתחות בסטייט וב-localStorage
      setOpenAIKey(openAIKey);
      setAzureOpenAIKey(azureOpenAIKey);
      localStorage.setItem("openAIKey", openAIKey);
      localStorage.setItem("azureOpenAIKey", azureOpenAIKey);

      setError(""); // מנקה את השגיאה

      // פותחים את המודל להודעת הצלחה
      setIsModalOpen(true);
    } catch (e) {
      setError("התרחשה שגיאה בשמירה, אנא נסה שנית.");
    } finally {
      setIsLoading(false); // סיום טעינה
    }
  };

  return (
    <div className="settings-container">
      <h3>הגדרות API</h3>
    
      {error && <div className="error-message">{error}</div>}
      <div>
        <label>מפתח OpenAI:</label>
  
        <input
          type="text"
          value={openAIKey}
          onChange={(e) => setOpenAIKeyLocal(e.target.value)}
          placeholder="הזן מפתח OpenAI"
        />
      </div>
      <div>
        <label>מפתח Azure OpenAI:</label>
        <input
          type="text"
          value={azureOpenAIKey}
          onChange={(e) => setAzureOpenAIKeyLocal(e.target.value)}
          placeholder="הזן מפתח Azure OpenAI"
        />
      </div>
      <button onClick={handleSave} disabled={isLoading}>
        {isLoading ? "שומר..." : "שמור הגדרות"}
      </button>

      {/* מודל של הצלחה */}
      <Modal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        contentLabel="הגדרות נשמרו"
        className="modal-content"
        overlayClassName="modal-overlay"
      >
        <h3>הגדרות נשמרו בהצלחה!</h3>
        <button onClick={() => setIsModalOpen(false)}>סגור</button>
      </Modal>
    </div>
  );
};

export default Settings;
