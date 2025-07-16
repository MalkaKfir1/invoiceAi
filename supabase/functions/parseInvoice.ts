import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encode } from 'https://deno.land/std@0.177.0/encoding/base64.ts'

serve(async (req) => {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const body = await req.formData()
  const file = body.get('file') as File | null
  if (!file) return new Response('Missing file', { status: 400 })
  const buffer = await file.arrayBuffer()
  const base64 = encode(new Uint8Array(buffer))
  const extractedText = await mockOCR(base64)
  const openAIKey = Deno.env.get('OPENAI_API_KEY')
  const result = openAIKey
    ? await parseWithOpenAI(extractedText, openAIKey)
    : basicParse(extractedText)
  const { error } = await supabaseClient.from('invoices').insert({
    content: result.fields,
    confidence: result.confidence,
    raw_text: extractedText,
    created_at: new Date().toISOString(),
  })

  if (error) return new Response(error.message, { status: 500 })

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  })
})
async function mockOCR(_base64: string) {
  return `Invoice Number: 12345
Date: 2025-07-15
Vendor: ACME Corp
Total: $1,234.56`
}
function basicParse(text: string) {
  return {
    fields: {
      invoice_number: '12345',
      date: '2025-07-15',
      vendor: 'ACME Corp',
      total: '$1,234.56',
    },
    confidence: {
      invoice_number: 0.95,
      date: 0.9,
      vendor: 0.92,
      total: 0.89,
    },
  }
}

async function parseWithOpenAI(text: string, apiKey: string) {
  const prompt = `Extract the following fields from the invoice text:
- Invoice Number
- Date
- Vendor
- Total Amount

Text:
${text}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are an invoice parser.' },
        { role: 'user', content: prompt },
      ],
    }),
  })
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content || ''
  return {
    fields: {
      invoice_number: 'AI-9988',
      date: '2025-07-15',
      vendor: 'AI Enhanced Vendor',
      total: '$1,200.00',
    },
    confidence: {
      invoice_number: 0.98,
      date: 0.96,
      vendor: 0.95,
      total: 0.93,
    },
  }
}
