const Groq = require('groq-sdk');

let groqInstance = null;

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    return null;
  }
  if (!groqInstance) {
    groqInstance = new Groq({ apiKey });
  }
  return groqInstance;
}

function getGroqModel() {
  return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
}

/**
 * Ask Groq to return a JSON object. Returns null if no API key is configured
 * or if the request/parse fails so callers can fall back cleanly.
 */
async function generateGroqJson(systemPrompt, userPrompt, { temperature = 0.4, maxTokens = 1200 } = {}) {
  const client = getGroqClient();
  if (!client) return null;

  try {
    const completion = await client.chat.completions.create({
      model: getGroqModel(),
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    const content = completion?.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch (err) {
    console.warn('[Groq] Falling back due to error:', err.message);
    return null;
  }
}

module.exports = {
  getGroqClient,
  getGroqModel,
  generateGroqJson
};

