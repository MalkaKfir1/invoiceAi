export async function improveInvoiceDataWithOpenAI(ocrText, apiKey) {
  const prompt = `
Analyze the following OCR invoice text and extract these fields:
- Invoice Number
- Date
- Vendor
- Before VAT (if possible)
- Total Amount
- Line Items (as a list of item descriptions)

Format your response as a JSON object with these keys:
{
  "invoiceNumber": "",
  "date": "",
  "vendor": "",
  "beforeVat": "",
  "total": "",
  "lineItems": ["..."]
}

Only return the JSON. Do not add explanations.

OCR Text:
"""${ocrText}"""
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    }),
  });

  const data = await response.json();

  try {
    const jsonText = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(jsonText);
    return parsed;
  } catch (err) {
    console.error("שגיאה בפיענוח JSON מה-AI:", err);
    return null;
  }
}
