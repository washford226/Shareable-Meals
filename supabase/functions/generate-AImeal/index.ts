// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

serve(async (req) => {
  const { prompt, dietaryRestrictions, allergies, pantryItems = [] } = await req.json();
  
  const fullPrompt = `
You are an expert meal planner and nutritionist.

Create a meal with the following structure and return it as a JSON code block.

Prompt: "${prompt}"
${dietaryRestrictions ? `Dietary restrictions: ${dietaryRestrictions}` : ""}
${allergies ? `Allergies to avoid: ${allergies}` : ""}
${pantryItems.length > 0 ? `Use only these ingredients: ${pantryItems.join(", ")}` : ""}

IMPORTANT:
- Ingredients must be in a 2D array format: [ [name, qty, unit], ... ]
- Include accurate macro information (calories, protein, fat, carbohydrates) PER SERVING
- Calculate macros for ONE serving only, not the total for all servings
- Return ONLY a JSON object wrapped in a \`\`\`json code block
- Do not add any explanation or extra text

Example:
\`\`\`json
{
  "name": "Chicken Stir Fry",
  "description": "A quick and healthy stir-fried chicken dish.",
  "servings": "2",
  "ingredients": [
    ["chicken breast", "1", "lb"],
    ["soy sauce", "2", "tbsp"],
    ["broccoli", "1", "cup"]
  ],
  "instructions": "1. Cut chicken. 2. Stir-fry chicken. 3. Add broccoli. 4. Add sauce. 5. Serve.",
  "macros": {
    "calories": 450,
    "protein": 55,
    "fat": 8,
    "carbohydrates": 25
  }
}
\`\`\`
`;

  const openaiKey = Deno.env.get("GPT_Test_Key");
  if (!openaiKey) {
    return new Response(JSON.stringify({
      error: "Missing OpenAI API key"
    }), {
      status: 500
    });
  }

  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "user",
          content: fullPrompt
        }
      ]
    })
  });

  const result = await aiRes.json();
  const rawContent = result?.choices?.[0]?.message?.content?.trim();
  
  if (!rawContent) {
    return new Response(JSON.stringify({
      error: "No response from AI"
    }), {
      status: 500
    });
  }

  // Extract JSON inside triple-backtick code block
  const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```/i);
  const jsonText = jsonMatch?.[1];
  
  if (!jsonText) {
    return new Response(JSON.stringify({
      error: "AI response did not include a valid JSON code block",
      raw: rawContent
    }), {
      status: 500
    });
  }

  try {
    const parsed = JSON.parse(jsonText);
    
    // Ensure macros exist and have default values if missing
    if (!parsed.macros) {
      parsed.macros = {
        calories: 0,
        protein: 0,
        fat: 0,
        carbohydrates: 0
      };
    }
    
    return new Response(JSON.stringify(parsed), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: "Failed to parse JSON inside code block",
      raw: jsonText,
      details: err.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});
