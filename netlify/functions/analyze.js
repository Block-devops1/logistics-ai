exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { text } = JSON.parse(event.body);
    // This looks for the key you will save in the Netlify Dashboard later
    const API_KEY = process.env.OPENROUTER_API_KEY; 

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "meta-llama/llama-3.3-70b-instruct:free",
                "messages": [
                    { "role": "system", "content": "Extract: 1. Sender, 2. Receiver, 3. Weight, 4. Tracking Number." },
                    { "role": "user", "content": text }
                ]
            })
        });

        const data = await response.json();
        return { statusCode: 200, body: JSON.stringify(data) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};