
export async function improveInvoiceDataWithOpenAI(ocrText, apiKey) {
  const prompt = `
Analyze this OCR invoice text and extract:
- Invoice Number
- Date
- Vendor
- Line Items
- Total

Text:
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
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "No AI response";
}
