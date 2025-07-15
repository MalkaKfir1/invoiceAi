import React, { useEffect, useRef, useState } from "react";
import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import "./PdfUploader.css";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.entry";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

export default function PdfUploader() {
  const [text, setText] = useState("");
  const [extractedData, setExtractedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const workerRef = useRef(null);

  useEffect(() => {
    const initWorker = async () => {
      const worker = await createWorker({ logger: m => console.log(m) });
      await worker.load();
      await worker.loadLanguage("heb+eng");
      await worker.initialize("heb+eng");
      workerRef.current = worker;
      setIsWorkerReady(true);
    };
    initWorker();
    return () => workerRef.current?.terminate();
  }, []);

  const getConfidenceIcon = (confidence) => {
    if (confidence >= 85) return "✅";
    if (confidence >= 70) return "⚠️";
    if (confidence >= 50) return "🟡";
    return "❌";
  };

  const extractInvoiceData = (text) => {
    const data = {
      invoiceNumber: { value: null, confidence: 0 },
      date: { value: null, confidence: 0 },
      supplier: { value: null, confidence: 0 },
      totalAmount: { value: null, confidence: 0 },
      lineItems: []
    };

    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

    const findPattern = (patterns, field) => {
      for (const { pattern, confidence } of patterns) {
        for (const line of lines) {
          const match = line.match(pattern);
          if (match && !data[field].value) {
            data[field] = { value: match[1], confidence };
            return;
          }
        }
      }
    };

    findPattern([
      { pattern: /(?:חשבונית|invoice)[^\d]*(\d+)/i, confidence: 95 },
      { pattern: /מס[׳"]?\s*(\d+)/, confidence: 85 },
      { pattern: /(^\d{5,})/, confidence: 70 }
    ], "invoiceNumber");

    findPattern([
      { pattern: /תאריך[^\d]*(\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{2,4})/, confidence: 95 },
      { pattern: /\b(\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{2,4})\b/, confidence: 85 }
    ], "date");

    findPattern([
      { pattern: /(?:ספק|שם העסק)[\s:]*([א-ת\s"']+)/, confidence: 90 },
      { pattern: /^([א-ת][א-ת\s]{3,20})$/, confidence: 70 }
    ], "supplier");

    findPattern([
      { pattern: /(?:סכום|סה"כ|לתשלום)[^\d]*[:\s]*([\d,\.]+)/, confidence: 95 },
      { pattern: /₪\s*([\d,\.]+)/, confidence: 85 }
    ], "totalAmount");

    data.lineItems = lines
      .filter(l =>
        (/\d+\s*[xX]\s*\d+/.test(l) || /₪/.test(l) || /\d{1,3}[.,]?\d{0,2}/.test(l)) &&
        l.split(/\s+/).length >= 3
      )
      .map(l => ({ line: l }));

    return data;
  };

  const convertPdfPageToImage = async (pdf, pageNum) => {
    const page = await pdf.getPage(pageNum);
    const scale = 3.5;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport }).promise;
    return canvas;
  };

  const extractTextWithTesseract = async (pdf) => {
    let result = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const canvas = await convertPdfPageToImage(pdf, i);
      const { data: { text } } = await workerRef.current.recognize(canvas);
      result += text + "\n";
    }
    return result;
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const fileReader = new FileReader();
      fileReader.onload = async (e) => {
        const arrayBuffer = e.target.result;
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let textContent = "";
        for (let i = 0; i < pdf.numPages; i++) {
          const page = await pdf.getPage(i + 1);
          const content = await page.getTextContent();
          const pageText = content.items.map(item => item.str).join(" ");
          textContent += pageText + "\n";
        }
        if (!textContent.trim() && isWorkerReady) {
          textContent = await extractTextWithTesseract(pdf);
        }
        setText(textContent);
        setExtractedData(extractInvoiceData(textContent));
      };
      fileReader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("Error extracting PDF:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <input
        type="file"
        id="pdf-upload"
        accept="application/pdf"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <label htmlFor="pdf-upload" className={`upload-label ${loading ? "disabled" : ""}`}>
        {loading ? "🚀 מעבד חשבונית..." : "📄 בחר קובץ PDF"}
      </label>

      {text && (
        <div className="text-output">
          <h3>📜 טקסט מהחשבונית:</h3>
          <pre>{text}</pre>
        </div>
      )}

      {extractedData && (
        <div className="extracted-data">
          <h3>🔍 נתונים שחולצו</h3>
          <div className="summary">
            <h4>סיכום</h4>
            <span>מס׳ חשבונית: {extractedData.invoiceNumber.value || "❌"} {getConfidenceIcon(extractedData.invoiceNumber.confidence)}</span>
            <span>תאריך: {extractedData.date.value || "❌"} {getConfidenceIcon(extractedData.date.confidence)}</span>
            <span>ספק: {extractedData.supplier.value || "❌"} {getConfidenceIcon(extractedData.supplier.confidence)}</span>
            <span>סכום כולל: {extractedData.totalAmount.value || "❌"} ₪ {getConfidenceIcon(extractedData.totalAmount.confidence)}</span>
          </div>

          {extractedData.lineItems.length > 0 && (
            <div className="line-items-table">
              <h4>📦 פריטי שורה</h4>
              <table>
                <thead>
                  <tr><th>#</th><th>תיאור</th></tr>
                </thead>
                <tbody>
                  {extractedData.lineItems.map((item, idx) => (
                    <tr key={idx}><td>{idx + 1}</td><td>{item.line}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
