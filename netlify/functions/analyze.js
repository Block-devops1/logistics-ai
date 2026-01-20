const fetch = require("node-fetch");
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

exports.handler = async (event) => {
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;
  const GOOGLE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const GOOGLE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'); // The 'newline' fix

  try {
    const { text } = JSON.parse(event.body);

    // --- STEP 1: ASK LLAMA AI ---
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [
          { role: "system", content: "Extract logistics info as JSON: sender, receiver, tracking_number, items." },
          { role: "user", content: text }
        ],
        response_format: { type: "json_object" } // Force JSON output
      })
    });

    const aiData = await aiResponse.json();
    const extracted = JSON.parse(aiData.choices[0].message.content);

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
      body: JSON.stringify({ message: "Success! Data saved to Sheet.", data: extracted })
    };

  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};