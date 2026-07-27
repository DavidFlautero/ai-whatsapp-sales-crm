import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";

export async function transcribeAudio(filePath: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY missing");
  }

  const form = new FormData();

  form.append(
    "file",
    fs.createReadStream(path.resolve(filePath))
  );

  form.append(
    "model",
    "whisper-large-v3-turbo"
  );

  form.append(
    "language",
    "es"
  );

  const response = await axios.post(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    form,
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        ...form.getHeaders(),
      },
      maxBodyLength: Infinity,
    }
  );

  return response.data.text || "";
}
