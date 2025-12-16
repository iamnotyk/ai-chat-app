/* eslint-disable @typescript-eslint/no-require-imports */
const { GoogleGenAI } = require("@google/genai");

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not defined");
    return;
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    // SDK 문서에 따르면 models.list() 같은 메서드가 있을 수 있음
    // 또는 raw request로 확인해야 함.
    // @google/genai 최신 버전에서는 ai.models.list() 형태일 가능성이 높음
    const response = await ai.models.list(); 
    console.log("Available models:");
    for await (const model of response) {
      console.log(`- ${model.name}`);
    }
  } catch (error) {
    console.error("Error listing models:", error);
  }
}

listModels();
