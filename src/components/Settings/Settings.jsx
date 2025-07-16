import React, { useState, useEffect } from "react";
import Modal from "react-modal";
import "./Settings.css";

Modal.setAppElement("#root");

const Settings = ({ setOpenAIKey, setAzureOpenAIKey }) => {
  const [openAIKey, setOpenAIKeyLocal] = useState("");
  const [azureOpenAIKey, setAzureOpenAIKeyLocal] = useState("");
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const storedOpenAIKey = localStorage.getItem("openai_api_key");
    const storedAzureKey = localStorage.getItem("azure_openai_key");

    if (storedOpenAIKey) setOpenAIKeyLocal(storedOpenAIKey);
    if (storedAzureKey) setAzureOpenAIKeyLocal(storedAzureKey);
  }, []);

  const validateKey = (key) => {
    return typeof key === "string" && key.length >= 8;
  };

  const handleSave = () => {
    if (!openAIKey || !azureOpenAIKey) {
      setError("נא להזין את שני המפתחות");
      return;
    }

    if (!validateKey(openAIKey)) {
      setError("מפתח OpenAI לא תקין (חייב להכיל לפחות 8 תווים)");
      return;
    }

    if (!validateKey(azureOpenAIKey)) {
      setError("מפתח Azure OpenAI לא תקין (חייב להכיל לפחות 8 תווים)");
      return;
    }

    try {
      setIsLoading(true);
      setOpenAIKey(openAIKey);
      setAzureOpenAIKey(azureOpenAIKey);
      localStorage.setItem("openai_api_key", openAIKey);
      localStorage.setItem("azure_openai_key", azureOpenAIKey);

      setError("");
      setIsModalOpen(true);
    } catch {
      setError("אירעה שגיאה בשמירה, אנא נסי שוב.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="settings-container">
      <h2>🔐 הגדרות מפתחות API</h2>

      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label>🔑 מפתח OpenAI</label>
        <input
          type="text"
          value={openAIKey}
          onChange={(e) => setOpenAIKeyLocal(e.target.value)}
          placeholder="sk-..."
        />
      </div>

      <div className="form-group">
        <label>🔑 מפתח Azure OpenAI</label>
        <input
          type="text"
          value={azureOpenAIKey}
          onChange={(e) => setAzureOpenAIKeyLocal(e.target.value)}
          placeholder="azure-..."
        />
      </div>

      <button className="save-btn" onClick={handleSave} disabled={isLoading}>
        {isLoading ? "שומר..." : "💾 שמור הגדרות"}
      </button>

      <Modal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        contentLabel="הגדרות נשמרו"
        className="modal-content"
        overlayClassName="modal-overlay"
      >
        <h3>✅ הגדרות נשמרו בהצלחה!</h3>
        <button onClick={() => setIsModalOpen(false)}>סגור</button>
      </Modal>
    </div>
  );
};

export default Settings;
