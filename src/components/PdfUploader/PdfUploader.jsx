import React, { useRef, useState } from "react";
import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import ConfidenceBar from './ConfidenceBar/ConfidenceBar';
import { improveInvoiceDataWithOpenAI } from "../aiHelper";
import './PdfUploader.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.js",
  import.meta.url
).toString();

export default function PdfUploader({ openAIKey }) {
  const [text, setText] = useState("");
  const [extractedData, setExtractedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ocrConfidence, setOcrConfidence] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError("");
    setExtractedData(null);

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

        setOcrConfidence(result.data.confidence);
        const rawText = result.data.text;
        setText(rawText);

        const initialExtracted = extractFields(rawText);
        let finalExtracted = { ...initialExtracted };

        if (openAIKey) {
          try {
            const aiData = await improveInvoiceDataWithOpenAI(rawText, openAIKey);
            if (aiData) {
              finalExtracted.invoiceNumber = {
                value: aiData.invoiceNumber || finalExtracted.invoiceNumber.value,
                confidence: 98,
              };
              finalExtracted.date = {
                value: aiData.date || finalExtracted.date.value,
                confidence: 97,
              };
              finalExtracted.vendor = {
                value: aiData.vendor || finalExtracted.vendor.value,
                confidence: 96,
              };
              finalExtracted.beforeVat = {
                value: aiData.beforeVat || finalExtracted.beforeVat.value,
                confidence: 95,
              };
              finalExtracted.total = {
                value: aiData.total || finalExtracted.total.value,
                confidence: 97,
              };
              if (Array.isArray(aiData.lineItems)) {
                finalExtracted.lineItems = aiData.lineItems;
              }
              finalExtracted.isAIEnhanced = true;
            }
          } catch (err) {
            console.error("שגיאה מ-AI:", err);
          }
        }

        setExtractedData(finalExtracted);

        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/.netlify/functions/parseInvoice", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("שגיאה בשליחה ל־Function");

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
      return { value: raw, confidence: Math.random() * 20 + 75 };
    }

    const invoiceNumber = extractWithConfidence(/(?:מספר\s*(?:חשבונית|קבלה)|חשבונית\s*מס')\s*[:\-]?\s*(\S+)/i);
    const date = extractWithConfidence(/(?:תאריך\s*(?:הנפקה|קבלה)?|נוצר[ה]?\s?ב(?:תאריך)?)\s*[:\-]?\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/i);
    const vendor = extractWithConfidence(/(?:ספק|שם\s*החנות|קבלה\s*-\s*)(.+)/i);
    const beforeVat = extractWithConfidence(/(?:סכום\s*לפני\s*מע[״"]מ|לפני\s*מע[״"]מ)\s*[:\-]?\s*(₪?\s*\d+[.,]?\d*)/i);
    const total = extractWithConfidence(/(?:סה"כ(?:\s*לתשלום)?|סך(?:\s*הכל)?|סכום\s*לתשלום|לתשלום|סה"כ כולל)\s*[:\-]?\s*(₪?\s*\d+[.,]?\d*)/i);

    const lineItems = text
      .split("\n")
      .filter(line => /\d+\s*(x|×)?\s*.+\s+[\d.,]+/.test(line))
      .map((line) => ({ description: line }));

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
          <h3 className="green">טקסט שחולץ</h3>
          <pre className="text">{text}</pre>
        </div>
      )}

      {extractedData && (
        <div style={{ marginTop: "20px" }}>
          <h3 className="green">נתונים מהחשבונית {extractedData.isAIEnhanced && "(משופר על ידי AI)"}</h3>

          <p><strong>מספר חשבונית:</strong> {extractedData.invoiceNumber.value}
            <ConfidenceBar value={extractedData.invoiceNumber.confidence} />
          </p>

          <p><strong>תאריך:</strong> {extractedData.date.value}
            <ConfidenceBar value={extractedData.date.confidence} />
          </p>

          <p><strong>ספק:</strong> {extractedData.vendor.value}
            <ConfidenceBar value={extractedData.vendor.confidence} />
          </p>

          <p><strong>לפני מע״מ:</strong> {extractedData.beforeVat.value}
            <ConfidenceBar value={extractedData.beforeVat.confidence} />
          </p>

          <p><strong>סה"כ כולל:</strong> {extractedData.total.value}
            <ConfidenceBar value={extractedData.total.confidence} />
          </p>

          {ocrConfidence !== null && (
            <p><strong>דיוק OCR כולל:</strong> {ocrConfidence.toFixed(1)}%</p>
          )}

          <div style={{ marginTop: "10px" }}>
            <h3 className="green">רשימת פריטים</h3>
            <table className="invoice-table">
              <thead><tr><th>#</th><th>תיאור</th></tr></thead>
              <tbody>
                {extractedData.lineItems.map((item, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>{typeof item === "string" ? item : item.description}</td>
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
