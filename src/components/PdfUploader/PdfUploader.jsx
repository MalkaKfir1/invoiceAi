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
    const invoiceNumber = text.match(/(?:מספר\s*(?:חשבונית|קבלה)|חשבונית\s*מס')\s*[:\-]?\s*(\S+)/i)?.[1] || "לא זוהה";
    const date = text.match(/(?:תאריך\s*(?:הנפקה|קבלה)?|נוצר[ה]?\s?ב(?:תאריך)?)\s*[:\-]?\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/i)?.[1] || "לא זוהה";
    const vendor = text.match(/(?:ספק|שם\s*החנות|קבלה\s*-\s*)(.+)/i)?.[1]?.trim() || "לא זוהה";

    const total = text.match(/(?:סה"כ(?:\s*לתשלום)?|סך\s*הכל|סה"כ כולל)\s*[:\-]?\s*(₪?\s*\d+[.,]?\d*)/i)?.[1] || "לא זוהה";

    const lineItems = text
      .split("\n")
      .filter(line => /\d+\s*(x|×)?\s*.+\s+[\d.,]+/.test(line));

    return { invoiceNumber, date, vendor, total, lineItems };
  }

  return (
    <div>
      <label htmlFor="pdf-upload" className="upload-label">
        📤 pdf בחק קובץ
      </label>

      <input
        type="file"
        id="pdf-upload"
        accept="application/pdf"
        onChange={handleFileChange}
        ref={fileInputRef}
        className="hidden-input"
      />

      {loading && <p className="txtColorGreen">🔄 מפענח את הקובץ..., אנא המתן</p>}

      {text && (
        <div style={{ marginTop: "20px" }}>
          <h3 className="green">📄 :טקסט שחולץ</h3>
          <pre className="text">{text}</pre>
        </div>
      )}

      {extractedData && (
        <div style={{ marginTop: "20px" }}>
          <h3 className="green">📋 נתונים מהחשבונית</h3>
          <p><strong>📎 מספר חשבונית:</strong> {extractedData.invoiceNumber}</p>
          <p><strong>📅 תאריך:</strong> {extractedData.date}</p>
          <p><strong>🏢 ספק:</strong> {extractedData.vendor}</p>
          <p><strong>💰 סכום כולל:</strong> {extractedData.total}</p>
          {confidence !== null && (
            <p>{confidence.toFixed(1)}% <strong>🎯:דיוק OCR</strong> </p>
          )}
          <div style={{ marginTop: "10px" }}>
            <h3 className="green">🛒 רשימת פריטים</h3>

            <table className="invoice-table">
              <thead>
                <tr>
                  <th className="right-align">#</th>
                  <th>תיאור </th>
                </tr>
              </thead>
              <tbody>
                {extractedData.lineItems.map((item, idx) => (
                  <tr key={idx}>
                    <td className="right-align">{idx + 1}</td>
                    <td className="right-align">{item}</td>
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
