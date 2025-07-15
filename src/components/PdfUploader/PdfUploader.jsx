import React, { useRef, useState } from "react";
import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";

// הגדרת worker עבור Vite (חייב גרסה 2.16.105 של pdfjs-dist)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.js",
  import.meta.url
).toString();

export default function PdfUploader() {
  const [text, setText] = useState("");
  const [extractedData, setExtractedData] = useState(null);
  const [loading, setLoading] = useState(false);
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
    <div style={{ padding: "20px", maxWidth: "800px", margin: "auto", direction: "rtl" }}>
      <h2>📤 העלאת חשבונית PDF</h2>
      <input type="file" accept="application/pdf" onChange={handleFileChange} ref={fileInputRef} />
      {loading && <p>🔄 מפענח את הקובץ, אנא המתן...</p>}

      {text && (
        <div style={{ marginTop: "20px" }}>
          <h3>📄 טקסט שחולץ:</h3>
          <pre style={{ background: "#f0f0f0", padding: "10px", whiteSpace: "pre-wrap" }}>{text}</pre>
        </div>
      )}

      {extractedData && (
        <div style={{ marginTop: "20px" }}>
          <h3>📋 שדות שחולצו:</h3>
          <p><strong>📎 מספר חשבונית:</strong> {extractedData.invoiceNumber}</p>
          <p><strong>📅 תאריך:</strong> {extractedData.date}</p>
          <p><strong>🏢 ספק:</strong> {extractedData.vendor}</p>
          <p><strong>💰 סכום כולל:</strong> {extractedData.total}</p>
          <div>
            <strong>🛒 שורות פריטים:</strong>
            <ul>
              {extractedData.lineItems.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}