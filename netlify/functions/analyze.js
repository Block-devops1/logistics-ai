const fetch = require("node-fetch");
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

exports.handler = async (event) => {
  // 1. Setup Credentials
  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;
  const GOOGLE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const GOOGLE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

  try {
    const { text } = JSON.parse(event.body);

    // 2. Ask Llama 3.3 to extract the data
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [{ 
          role: "system", 
          content: "Extract data to JSON: sender, receiver, tracking_number, items. Respond ONLY with raw JSON. No chat." 
        }, { 
          role: "user", content: text 
        }]
      })
    });

    const aiData = await aiResponse.json();
    let content = aiData.choices[0].message.content;
    
    // Clean AI text to get only the JSON part
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}') + 1;
    const jsonString = content.substring(start, end);
    const extracted = JSON.parse(jsonString);

    // 3. Connect to Google Sheets
    const auth = new JWT({
      email: GOOGLE_EMAIL,
      key: GOOGLE_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    // 4. Add the row to your Spreadsheet
    await sheet.addRow({
      "Date": new Date().toLocaleString('en-GB', { timeZone: 'Africa/Lagos' }),
      "Sender": String(extracted.sender || "N/A"),
      "Receiver": String(extracted.receiver || "N/A"),
      "Tracking Number": String(extracted.tracking_number || "N/A"),
      "Description": typeof extracted.items === 'object' ? JSON.stringify(extracted.items) : String(extracted.items || "N/A")
    });

    // 5. Send Success back to your Website
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message: "Success! Data saved to Sheet.", 
        data: extracted 
      })
    };

  } catch (error) {
    console.error("Error:", error.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message })
    };
  }
};