import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = "gemini-3.6-flash";

export const gemini = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
