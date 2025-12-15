import { GoogleGenAI, Type } from "@google/genai";
import { GeminiShapeResponse } from "../types";

const SYSTEM_INSTRUCTION = `
You are a shape recognition assistant for a drawing app.
Analyze the provided image of a hand-drawn stroke.
Identify if it is one of these specific shapes: Triangle, Square (or Rectangle), or Circle (or Ellipse).

Rules:
1. If the drawing is a straight line, return 'none'.
2. If it is a random scribble, text, or ambiguous, return 'none'.
3. Only identify the shape if it clearly resembles a triangle, square, or circle.
`;

export const identifyShape = async (base64Image: string): Promise<GeminiShapeResponse> => {
  if (!process.env.API_KEY) {
    console.warn("API_KEY not found in environment variables.");
    return { isShape: false, shapeType: 'none' };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Remove header from base64 string if present
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanBase64
            }
          },
          {
            text: "Identify the shape. Return JSON."
          }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isShape: { type: Type.BOOLEAN },
            shapeType: { type: Type.STRING, enum: ['triangle', 'square', 'circle', 'none'] }
          },
          required: ['isShape', 'shapeType']
        }
      }
    });

    const text = response.text;
    if (!text) return { isShape: false, shapeType: 'none' };
    
    return JSON.parse(text) as GeminiShapeResponse;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return { isShape: false, shapeType: 'none' };
  }
};
