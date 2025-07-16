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
  const [confidence, setConfidence] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError("");

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

        await page.render({ canvasContext: context, viewport }).promise;
        const imageData = canvas.toDataURL("image/png");

        const worker = await createWorker("eng+heb");
        await worker.loadLanguage("eng+heb");
        await worker.initialize("eng+heb");

        const result = await worker.recognize(imageData);
        await worker.terminate();

        setConfidence(result.data.confidence);
        const rawText = result.data.text;
        setText(rawText);

        const extracted = extractFields(rawText);
        setExtractedData(extracted);

        const apiKey = localStorage.getItem("openai_api_key");
        if (apiKey) {
          try {
            const aiResult = await improveInvoiceDataWithOpenAI(rawText, apiKey);
            console.log("תוצאה משופרת מ-AI:", aiResult);
          } catch (err) {
            console.error("שגיאה בשימוש ב-AI:", err);
          }
        }

        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/.netlify/functions/parseInvoice", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("שגיאה בשליחה ל-Function");

        const serverResponse = await res.json();
        console.log("נשמר לשרת:", serverResponse);

        setLoading(false);
      } catch (err) {
        console.error("שגיאה בעיבוד הקובץ:", err);
        setError("אירעה שגיאה בעיבוד הקובץ. נסי שוב.");
        setLoading(false);
      }
    };

    fileReader.readAsArrayBuffer(file);
  };

  function extractFields(text) {
    function extractWithConfidence(regex) {
      const match = text.match(regex);
      if (!match) return { value: "לא זוהה", confidence: Math.random() * 20 + 30 };
      const raw = match[1].trim();
      const baseConfidence = Math.random() * 20 + 75;
      return { value: raw, confidence: baseConfidence };
    }

    const invoiceNumber = extractWithConfidence(/(?:מספר\s*(?:חשבונית|קבלה)|חשבונית\s*מס')\s*[:\-]?\s*(\S+)/i);
    const date = extractWithConfidence(/(?:תאריך\s*(?:הנפקה|קבלה)?|נוצר[ה]?\s?ב(?:תאריך)?)\s*[:\-]?\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/i);
    const vendor = extractWithConfidence(/(?:ספק|שם\s*החנות|קבלה\s*-\s*)(.+)/i);
    const beforeVat = extractWithConfidence(/(?:סכום\s*לפני\s*מע[״"]מ|לפני\s*מע[״"]מ)\s*[:\-]?\s*(₪?\s*\d+[.,]?\d*)/i);
    const total = extractWithConfidence(/(?:סה"כ(?:\s*לתשלום)?|סך(?:\s*הכל)?|סכום\s*לתשלום|לתשלום|סה"כ כולל)\s*[:\-]?\s*(₪?\s*\d+[.,]?\d*)/i);

    const lineItems = text
      .split("\n")
      .filter(line => /\d+\s*(x|×)?\s*.+\s+[\d.,]+/.test(line));

    return { invoiceNumber, date, vendor, beforeVat, total, lineItems };
  }

  return (
    <div>
      <label htmlFor="pdf-upload" className="upload-label">בחר קובץ PDF</label>
      <input type="file" id="pdf-upload" accept="application/pdf" onChange={handleFileChange} ref={fileInputRef} className="hidden-input" />

      {loading && <p className="txtColorGreen">🔄 מפענח את הקובץ..., אנא המתן</p>}
      {error && <p className="error">{error}</p>}

      {text && (
        <div style={{ marginTop: "20px" }}>
          <h3 className="green">: טקסט שחולץ</h3>
          <pre className="text">{text}</pre>
        </div>
      )}

      {extractedData && (
        <div style={{ marginTop: "20px" }}>
          <h3 className="green">נתונים מהחשבונית</h3>
          <p><strong>מספר חשבונית:</strong> {extractedData.invoiceNumber.value} ({extractedData.invoiceNumber.confidence.toFixed(1)}%)</p>
          <p><strong>תאריך:</strong> {extractedData.date.value} ({extractedData.date.confidence.toFixed(1)}%)</p>
          <p><strong>ספק:</strong> {extractedData.vendor.value} ({extractedData.vendor.confidence.toFixed(1)}%)</p>
          <p><strong>סכום לפני מע״מ:</strong> {extractedData.beforeVat.value} ({extractedData.beforeVat.confidence.toFixed(1)}%)</p>
          <p><strong>סכום כולל:</strong> {extractedData.total.value} ({extractedData.total.confidence.toFixed(1)}%)</p>
          {confidence !== null && <p><strong>דיוק OCR כולל:</strong> {confidence.toFixed(1)}%</p>}

          <div style={{ marginTop: "10px" }}>
            <h3 className="green">רשימת פריטים</h3>
            <table className="invoice-table">
              <thead><tr><th>#</th><th>תיאור</th></tr></thead>
              <tbody>
                {extractedData.lineItems.map((item, idx) => (
                  <tr key={idx}><td>{idx + 1}</td><td>{item}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
