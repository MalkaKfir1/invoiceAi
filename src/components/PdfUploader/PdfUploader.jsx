import React, { useRef, useState } from "react";
import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import './PdfUploader.css';


pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.js",
  import.meta.url
).toString();

export default function PdfUploader() {
  const [text, setText] = useState("");
  const [extractedData, setExtractedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confidence, setConfidence] = useState(null); // חדש
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const fileReader = new FileReader();
    fileReader.onload = async function () {
      try {
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        const imageData = canvas.toDataURL("image/png");

        const worker = await createWorker("eng+heb");
        const result = await worker.recognize(imageData);

        setConfidence(result.data.confidence); // חדש

        const rawText = result.data.text;
        setText(rawText);

        const extracted = extractFields(rawText);
        setExtractedData(extracted);

        setLoading(false);
      } catch (err) {
        console.error("שגיאה בעיבוד הקובץ:", err);
        setLoading(false);
      }
    };
    fileReader.readAsArrayBuffer(file);
  };

  function extractFields(text) {
    const invoiceNumber = text.match(/מספר\s*חשבונית\s*[:\-]?\s*(\S+)/)?.[1] || "לא זוהה";
    const date = text.match(/תאריך\s*[:\-]?\s*(\d{2}[\/.\-]\d{2}[\/.\-]\d{4})/)?.[1] || "לא זוהה";
    const vendor = text.match(/ספק\s*[:\-]?\s*(.+)/)?.[1]?.trim() || "לא זוהה";
    const total = text.match(/לתשלום\s*[:\-]?\s*(\d+[.,]?\d*)/)?.[1] || "לא זוהה";

    const lineItems = text
      .split("\n")
      .filter(line => /\d+\s*(x|×)?\s*.+\s+[\d.,]+/.test(line));

    return { invoiceNumber, date, vendor, total, lineItems };
  }

  return (
    <div>
      <label htmlFor="pdf-upload" className="upload-label">
        📤 בחר קובץ PDF
      </label>

      <input
        type="file"
        id="pdf-upload"
        accept="application/pdf"
        onChange={handleFileChange}
        ref={fileInputRef}
        className="hidden-input"
      />

      {loading && <p>🔄 מפענח את הקובץ..., אנא המתן</p>}

      {text && (
        <div style={{ marginTop: "20px" }}>
          <h3>📄 :טקסט שחולץ</h3>
          <pre style={{ background: "#f0f0f0", padding: "10px", whiteSpace: "pre-wrap" }}>{text}</pre>
        </div>
      )}

      {extractedData && (
        <div style={{ marginTop: "20px" }}>
          <h3>📋 נתונים מהחשבונית</h3>
          <p><strong>📎 מספר חשבונית:</strong> {extractedData.invoiceNumber}</p>
          <p><strong>📅 תאריך:</strong> {extractedData.date}</p>
          <p><strong>🏢 ספק:</strong> {extractedData.vendor}</p>
          <p><strong>💰 סכום כולל:</strong> {extractedData.total}</p>
          {confidence !== null && (
            <p><strong>🎯 דיוק OCR:</strong> {confidence.toFixed(1)}%</p>
          )}
          <div style={{ marginTop: "10px" }}>
            <strong>🛒 רשימת פריטים:</strong>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8f8f8" }}>
                  <th style={{ border: "1px solid #ccc", padding: "8px" }}>#</th>
                  <th style={{ border: "1px solid #ccc", padding: "8px" }}>תיאור שורה</th>
                </tr>
              </thead>
              <tbody>
                {extractedData.lineItems.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ border: "1px solid #ccc", padding: "8px", textAlign: "center" }}>{idx + 1}</td>
                    <td style={{ border: "1px solid #ccc", padding: "8px" }}>{item}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

      )}
    </div>
  );
}
