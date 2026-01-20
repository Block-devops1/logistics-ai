const fetch = require("node-fetch");

exports.handler = async (event) => {
  const API_KEY = process.env.OPENROUTER_API_KEY;
  
  try {
    const { text } = JSON.parse(event.body);
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://erics-logistics.netlify.app"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free", 
        messages: [
          { role: "system", content: "Extract logistics details: Sender, Receiver, Item, and Tracking Number." },
          { role: "user", content: text }
        ]
      })
    });

    const data = await response.json();
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: { message: error.message } }) };
  }
};