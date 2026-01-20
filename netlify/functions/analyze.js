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
          content: "Extract info to JSON: sender, receiver, tracking_number, items. Respond ONLY with raw JSON." 
        }, { 
          role: "user", content: text 
        }]
      })
    });

    const aiData = await aiResponse.json();
    let content = aiData.choices[0].message.content;
    
    // Clean AI response to ensure it's pure JSON
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}') + 1;
    const jsonString = content.substring(start, end);
    const extracted = JSON.parse(jsonString);

    // 2. SAVE TO GOOGLE SHEETS
    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    // Added String() wrappers to prevent "Invalid Values" errors
    await sheet.addRow({
      "Date": new Date().toLocaleString('en-GB', { timeZone: 'Africa/Lagos' }),
      "Sender": String(extracted.sender || "N/A"),
      "Receiver": String(extracted.receiver || "N/A"),
      "Tracking Number": String(extracted.tracking_number || "N/A"),
      "Description": typeof extracted.items === 'object' ? JSON.stringify(extracted.items) : String(extracted.items || "N/A")
    });

    // --- THE FIX IS HERE ---
    // We send back a 200 status and tell the browser it is a JSON response
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ 
        message: "Success! Row added to Google Sheets.", 
        data: extracted 
      })
    };

  } catch (error) {
    console.error("DETAILED ERROR:", error.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message })
    };
  }
};