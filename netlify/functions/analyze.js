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
    
    // Safety check for AI response
    if (!aiData.choices || aiData.choices.length === 0) {
      throw new Error("AI failed to return data. Check your OpenRouter key/balance.");
    }

    let content = aiData.choices[0].message.content;
    content = content.replace(/```json/g, "").replace(/```/g, "").trim();
    const extracted = JSON.parse(content);

    // 2. SAVE TO GOOGLE SHEETS
    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
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
      body: JSON.stringify({ message: "Success! Row added.", data: extracted })
    };

  } catch (error) {
    console.error("DETAILED ERROR:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};