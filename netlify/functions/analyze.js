const fetch = require("node-fetch");
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

exports.handler = async (event) => {
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;
  const GOOGLE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  
  // THE KEY CLEANER: Handles both single and double backslashes from Netlify
  const GOOGLE_KEY = process.env.GOOGLE_PRIVATE_KEY 
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/\n/g, '\n').trim() 
    : null;

  try {
    const { text } = JSON.parse(event.body);

    // --- STEP 1: AI EXTRACTION ---
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [
          { role: "system", content: "Extract to JSON: sender, receiver, tracking_number, items. Respond ONLY with JSON." },
          { role: "user", content: text }
        ]
      })
    });

    const aiData = await aiResponse.json();
    let content = aiData.choices[0].message.content;
    
    // Clean up AI response if it added ```json ... ``` blocks
    content = content.replace(/```json/g, "").replace(/```/g, "").trim();
    const extracted = JSON.parse(content);

    // --- STEP 2: SAVE TO GOOGLE SHEETS ---
    const auth = new JWT({
      email: GOOGLE_EMAIL,
      key: GOOGLE_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    await sheet.addRow({
      "Date": new Date().toLocaleString(),
      "Sender": extracted.sender || "N/A",
      "Receiver": extracted.receiver || "N/A",
      "Tracking Number": extracted.tracking_number || "N/A",
      "Description": extracted.items || "N/A"
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Saved to Sheets!", data: extracted })
    };

  } catch (error) {
    console.error("Error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};