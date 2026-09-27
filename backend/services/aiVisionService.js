const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const fs = require('fs');

/**
 * Validates the uploaded evidence against the complaint text using GPT-4 Vision
 * @param {Array<string>} imagePaths - Array of absolute file paths to uploaded images
 * @param {string} title - Complaint title
 * @param {string} description - Complaint description
 * @returns {Promise<{ isFake: boolean, reason: string }>}
 */
exports.detectFakeEvidence = async (imagePaths, title, description) => {
  try {
    if (!imagePaths || imagePaths.length === 0) {
      return { isFake: false, reason: 'No images provided' };
    }

    // Convert the first image to base64
    const firstImage = imagePaths[0];
    const imageBase64 = fs.readFileSync(firstImage, { encoding: 'base64' });
    const ext = firstImage.split('.').pop().toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');

    const prompt = `You are a strict AI Fraud Detection agent for a government grievance portal.
A citizen has submitted a complaint with the following details:
Title: "${title}"
Description: "${description}"

Attached is the photo evidence they uploaded. 
Analyze the image EXTREMELY STRICTLY against these rules:
1. Is the image a flowchart, diagram, text screenshot, meme, or graphic? -> REJECT (isFake: true)
2. Is the image completely irrelevant to the described grievance? (e.g., uploading a selfie for a pothole, or a dog for a fire) -> REJECT (isFake: true)
3. Does the image appear to be downloaded from the internet, a stock photo, or from a news channel? Look for watermarks, logos, unnatural professional lighting, or compression artifacts typical of generic internet imagery. -> REJECT (isFake: true)
4. The image MUST appear to be a real-world photograph taken recently by a citizen on a mobile phone, clearly showing the issue described in the text. If it looks like a generic web image or stock photography -> REJECT (isFake: true)

Return ONLY a JSON object in this exact format:
{
  "isFake": boolean,
  "reason": "Short explanation of why it is rejected, or 'Valid' if it is a legitimate real-world citizen photo of the issue."
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Upgraded from mini to detect stock photos more accurately
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: "high" // High detail required to spot watermarks and stock photo traits
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 150,
      temperature: 0.1
    });

    const result = JSON.parse(response.choices[0].message.content);
    console.log(`[AI Vision] Evaluated image for title: "${title}". Result:`, result);

    return {
      isFake: !!result.isFake,
      reason: result.reason || 'No reason provided.'
    };

  } catch (err) {
    console.error("AI Vision Detection Error:", err.message);
    // Fail-open: if the AI service crashes, we don't want to block legit complaints
    return { isFake: false, reason: "Detection bypassed due to error" };
  }
};
