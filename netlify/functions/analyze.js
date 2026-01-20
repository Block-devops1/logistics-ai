const fetch = require("node-fetch");
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

exports.handler = async (event) => {
  const GOOGLE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

  try {
    const { text } = JSON.parse(event.body);

    // 1. CALL AI
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [{ 
          role: "system", 
          content: "Extract info to JSON: sender, receiver, tracking_number, items. IMPORTANT: 'items' must be a single string of text, not a list." 
        }, { 
          role: "user", content: text 
        }]
      })
    });

    const aiData = await aiResponse.json();
    let content = aiData.choices[0].message.content;
    content = content.replace(/```json/g, "").replace(/```/g, "").trim();
    const extracted = JSON.parse(content);

    // DATA CLEANER: If the AI sends items as a list/object, turn it into text
    const cleanItems = typeof extracted.items === 'object' 
      ? JSON.stringify(extracted.items) 
      : extracted.items;

    // 2. SAVE TO GOOGLE SHEETS
    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    // These keys must match your Row 1 exactly
    await sheet.addRow({
      "Date": new Date().toLocaleString('en-GB', { timeZone: 'Africa/Lagos' }),
      "Sender": String(extracted.sender || "N/A"),
      "Receiver": String(extracted.receiver || "N/A"),
      "Tracking Number": String(extracted.tracking_number || "N/A"),
      "Description": String(cleanItems || "N/A")
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Logistics data saved!", data: extracted })
    };

  } catch (error) {
    console.error("DETAILED ERROR:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
// End of file: netlify/functions/analyze.js