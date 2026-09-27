const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Auto-translates a given text to English if it is in another language.
 * If it is already in English, it returns it as is.
 */
async function translateToEnglish(title, description) {
  try {
    const prompt = `You are an automated translation agent for an Indian E-Governance portal.
Your task is to detect the language of the provided Title and Description. 
If they are not in English (e.g. Hindi, Marathi, Hinglish, etc.), translate them to professional English.
If they are already in English, return them exactly as they are, but correct any major grammatical errors.
Do NOT output anything else besides the JSON object.

Title: "${title}"
Description: "${description}"

Return ONLY a JSON object in this exact format:
{
  "title": "Translated or original English title",
  "description": "Translated or original English description"
}`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [{ role: "system", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 500
    });

    const result = JSON.parse(response.choices[0].message.content);
    return {
      title: result.title || title,
      description: result.description || description
    };
  } catch (err) {
    console.error("AI Translation Error:", err.message);
    // Fail-open: Return original text if AI fails
    return { title, description };
  }
}

module.exports = { translateToEnglish };
