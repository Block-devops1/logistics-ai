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
        "HTTP-Referer": "https://erics-logistics.netlify.app", // Your site URL
        "X-Title": "Ericsson Logistics AI"
      },
      body: JSON.stringify({
        // We are using the 'free' version of Gemini to avoid balance issues
        model: "mistralai/mistral-7b-instruct:free", 
        messages: [
          {
            role: "system",
            content: "You are a logistics assistant. Extract the Sender, Receiver, Tracking Number, and Item Description from the text. Format the output clearly."
          },
          {
            role: "user",
            content: text
          }
        ]
      })
    });

    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: { message: error.message } })
    };
  }
};