// FileUpload.jsx
import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import Tesseract from "tesseract.js";
import PdfUploader from "../PdfUploader/PdfUploader";  

const FileUpload = () => {
  const [uploadStatus, setUploadStatus] = useState(null);
  const [extractedData, setExtractedData] = useState(null);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => handleFileUpload(acceptedFiles),
    accept: ".pdf",
  });

  const handleFileUpload = (acceptedFiles) => {
    setUploadStatus("העלאה בתהליך...");
    const file = acceptedFiles[0];
    if (file) {
      processOCR(file);
    }
  };

  const processOCR = (file) => {
    Tesseract.recognize(file, "eng", {
      logger: (m) => console.log(m),
    })
      .then(({ data: { text } }) => {
        setExtractedData(text);
        setUploadStatus("העלאה הצליחה!");
      })
      .catch((error) => {
        console.error("Error processing OCR:", error);
        setUploadStatus("העלאה נכשלה. נסה שוב");
      });
  };

  return (
    <div>
      <div {...getRootProps()} style={styles.dropzone}>
        <input {...getInputProps()} />
        <p>גרור ושחרר קובץ PDF כאן או לחץ לבחור קובץ.</p>
      </div>

      {uploadStatus && <div className="upload-status">{uploadStatus}</div>}

     
    </div>
  );
};

const styles = {
  dropzone: {
    border: "2px dashed #ccc",
    padding: "20px",
    textAlign: "center",
    cursor: "pointer",
    borderRadius: "8px",
    marginBottom: "20px",
  },
};

export default FileUpload;
