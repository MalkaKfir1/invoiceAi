import React, { useEffect, useRef, useState } from "react";
import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import './PdfUploader.css'; 

//pdfjsLib -והפקת טקסט מהם PDF משמשת לטעינת קובצי  
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
// ה-worker - מאפשר עיבודים נפרדים במקביל על ידי חלוקה לאיבודים נפרדים 

export default function PdfUploader() {
  const [text, setText] = useState("");
  const [extractedData, setExtractedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const workerRef = useRef(null);

  useEffect(() => {
    const initWorker = async () => {
      const worker = await createWorker({
        logger: (m) => console.log(m),
      });

      await worker.load();
      // טוען עברית ואנגלית
      await worker.loadLanguage("heb+eng");
      await worker.initialize("heb+eng");

      workerRef.current = worker;
      setIsWorkerReady(true);
    };

    initWorker();

    return () => {
      if (workerRef.current && typeof workerRef.current.terminate === "function") {
        workerRef.current.terminate();
      }
    };
  }, []);

  // פונקציה לקבלת צבע לפי רמת ביטחון
  function getConfidenceColor(confidence) {
    if (confidence >= 85) return "#28a745"; // ירוק
    if (confidence >= 70) return "#ffc107"; // צהוב
    if (confidence >= 50) return "#fd7e14"; // כתום
    return "#dc3545"; // אדום
  }

  // פונקציה לקבלת אייקון לפי רמת ביטחון
  function getConfidenceIcon(confidence) {
    if (confidence >= 85) return "✅";
    if (confidence >= 70) return "⚠️";
    if (confidence >= 50) return "🟡";
    return "❌";
  }

  // פונקציה לחילוץ נתונים מהטקסט עם אחוזי ביטחון
  function extractInvoiceData(text) {
    const data = {
      invoiceNumber: { value: null, confidence: 0 },
      date: { value: null, confidence: 0 },
      supplier: { value: null, confidence: 0 },
      totalAmount: { value: null, confidence: 0 },
      lineItems: []
    };

    const lines = text.split('\n').map(line => line.trim()).filter(line => line);

    // חיפוש מספר חשבונית
    const invoicePatterns = [
      { pattern: /(?:חשבונית|מספר|חש|invoice|number)[\s:]*(\d+)/i, confidence: 95 },
      { pattern: /מס[׳']?\s*(\d+)/, confidence: 85 },
      { pattern: /(\d{6,})/, confidence: 70 }
    ];

    for (const { pattern, confidence } of invoicePatterns) {
      for (const line of lines) {
        const match = line.match(pattern);
        if (match && !data.invoiceNumber.value) {
          data.invoiceNumber = { value: match[1], confidence };
          break;
        }
      }
      if (data.invoiceNumber.value) break;
    }

    // חיפוש תאריך
    const datePatterns = [
      { pattern: /תאריך[\s:]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/, confidence: 95 },
      { pattern: /(\d{1,2}\.\d{1,2}\.\d{4})/, confidence: 85 },
      { pattern: /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/, confidence: 75 },
      { pattern: /ביולי\s*(\d{1,2}\s*\d{4})/, confidence: 60 }
    ];

    for (const { pattern, confidence } of datePatterns) {
      for (const line of lines) {
        const match = line.match(pattern);
        if (match && !data.date.value) {
          data.date = { value: match[1], confidence };
          break;
        }
      }
      if (data.date.value) break;
    }

    // חיפוש ספק
    const supplierPatterns = [
      { pattern: /(?:שם הספק|שם העסק|ספק)[\s:]*([א-ת\s]+)/, confidence: 90 },
      { pattern: /^([א-ת][א-ת\s]+(?:בע״מ|בע"מ|ובניו|ושות|ltd|LTD))/, confidence: 85 },
      { pattern: /^([א-ת][א-ת\s]{3,20})$/, confidence: 70 }
    ];

    for (const { pattern, confidence } of supplierPatterns) {
      for (const line of lines.slice(0, 10)) { // רק 10 השורות הראשונות
        const match = line.match(pattern);
        if (match && !data.supplier.value && match[1].trim().length > 2) {
          data.supplier = { value: match[1].trim(), confidence };
          break;
        }
      }
      if (data.supplier.value) break;
    }

    // חיפוש סכום כולל
    const amountPatterns = [
      { pattern: /(?:סה״כ|סהכ|סך הכל|סך הכל לתשלום|total|Total)[\s:]*(\d+(?:[,\.]\d{2})?)/, confidence: 95 },
      { pattern: /(\d+\.\d{2})(?:\s*₪|\s*שח)/, confidence: 80 },
      { pattern: /₪\s*(\d+(?:[,\.]\d{2})?)/, confidence: 75 }
    ];

    for (const { pattern, confidence } of amountPatterns) {
      for (const line of lines) {
        const match = line.match(pattern);
        if (match && !data.totalAmount.value) {
          data.totalAmount = { value: match[1], confidence };
          break;
        }
      }
      if (data.totalAmount.value) break;
    }

    return data;
  }

  // המרת דף PDF לתמונה
  const convertPdfPageToImage = async (pdf, pageNum) => {
    const page = await pdf.getPage(pageNum);
    const scale = 3.0;  // הגדלת התמונה לשיפור דיוק ה-OCR
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;
    return canvas;
  };

  // חילוץ טקסט מתוך PDF בעזרת Tesseract
  const extractTextWithTesseract = async (pdf) => {
    let textContent = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const canvas = await convertPdfPageToImage(pdf, i);
      const { data: { text } } = await workerRef.current.recognize(canvas);

      // הדפסת הטקסט שהופק לעזור לך לנתח אם זה טקסט תקין
      console.log(`Text from page ${i}:`, text);
      
      textContent += text;  // נוסיף את הטקסט שהופק לכל העמודים
    }

    return textContent;
  };

  // טיפול בקובץ שנבחר
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);

    try {
      const fileReader = new FileReader();
      fileReader.onload = async (e) => {
        const arrayBuffer = e.target.result;
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let textContent = "";

        // חילוץ טקסט עם pdf.js אם אפשר
        for (let i = 0; i < pdf.numPages; i++) {
          const page = await pdf.getPage(i + 1);
          const content = await page.getTextContent();
          const pageText = content.items.map(item => item.str).join(" ");
          textContent += " " + pageText;
        }

        // אם לא נמצא טקסט, נבצע OCR עם Tesseract
        if (!textContent.trim() && isWorkerReady) {
          textContent = await extractTextWithTesseract(pdf);
        }

        setText(textContent);

        // חילוץ הנתונים
        const data = extractInvoiceData(textContent);
        setExtractedData(data);
      };

      fileReader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error extracting text from file:", error);
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
      <label htmlFor="pdf-upload" className={`upload-label ${loading ? 'disabled' : ''}`} disabled={loading}>
        {loading ? 'טעינה...' : 'בחר קובץ PDF'}
      </label>

      {text && (
        <div className="text-output">
          <h3>טקסט שהופק מהחשבונית:</h3>
          <pre className="text">{text}</pre>
        </div>
      )}

      {extractedData && (
        <div className="extracted-data">
          <h3>נתונים שהופקו:</h3>
          <div className="summary">
            <h4>סיכום</h4>
            <span>מספר חשבונית: {extractedData.invoiceNumber.value || "❌"} {getConfidenceIcon(extractedData.invoiceNumber.confidence)} </span>
            <span>תאריך: {extractedData.date.value || "❌"} {getConfidenceIcon(extractedData.date.confidence)} </span>
            <span>ספק: {extractedData.supplier.value || "❌"} {getConfidenceIcon(extractedData.supplier.confidence)} </span>
            <span>סכום כולל: {extractedData.totalAmount.value ? `${extractedData.totalAmount.value} ₪` : "❌"} {getConfidenceIcon(extractedData.totalAmount.confidence)} </span>
          </div>
        </div>
      )}
    </div>
  );
}
