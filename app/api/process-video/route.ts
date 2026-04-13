import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';

// Vercel Timeout එක තත්පර 60ක් දක්වා වැඩි කිරීම
export const maxDuration = 60; 

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { videoUrl } = await req.json();

    if (!videoUrl) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    console.log("Extracting and compressing audio from Cloudinary...");
    
    // 🟢 Magic URL Hack: Cloudinary එක හරහාම Video එක 64kbps MP3 එකකට Convert කරලා ගන්නවා. 
    // මේකෙන් 100MB වීඩියෝ එකක් වුණත් 5MB වගේ පොඩි Audio එකක් වෙලා OpenAI එකට යනවා.
    const urlParts = videoUrl.split('/upload/');
    const compressedAudioUrl = `${urlParts[0]}/upload/f_mp3,ac_mp3,br_64k/${urlParts[1].replace(/\.[^/.]+$/, ".mp3")}`;

    console.log("Fetching optimized audio:", compressedAudioUrl);

    const audioResponse = await fetch(compressedAudioUrl);
    if (!audioResponse.ok) throw new Error("Failed to fetch audio from Cloudinary");
    
    const arrayBuffer = await audioResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // OpenAI 25MB Limit එකට අහු නොවෙන්න Safety Check එකක්
    if (buffer.length > 25 * 1024 * 1024) {
       throw new Error("Audio exceeds OpenAI's 25MB limit. Please upload a shorter video.");
    }
    
    const file = await toFile(buffer, 'audio.mp3', { type: 'audio/mp3' });

    console.log("Sending to OpenAI Whisper...");

    const whisperParams: any = {
      file: file,
      model: "whisper-1",
      response_format: "vtt",
      temperature: 0,
      language: "en" // Strictly English for MVP
    };

    let transcription: any;
    try {
      transcription = await openai.audio.transcriptions.create(whisperParams);
    } catch (error: any) {
      if (error?.code === 'unsupported_language') {
        const fallbackParams: any = { ...whisperParams };
        delete fallbackParams.language;
        fallbackParams.prompt = "Transcribe accurately in English.";
        transcription = await openai.audio.transcriptions.create(fallbackParams);
      } else {
        throw error;
      }
    }

    // 🟢 Generate AI Growth Strategy (Marketing Insights)
    let marketingInsights = null;
    try {
      console.log("Analyzing content for marketing insights...");
      const gptResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { 
            role: "system", 
            content: `You are an expert social media growth hacker. Analyze the following video transcript. 
            Return a JSON object strictly in this format:
            {
              "audience": "1-3 words describing the target audience",
              "title": "A catchy, viral hook/title for the video",
              "platforms": ["TikTok", "Reels"],
              "hashtags": ["#viral", "#trending", "#tag3", "#tag4"]
            }`
          },
          { role: "user", content: transcription }
        ]
      });
      marketingInsights = JSON.parse(gptResponse.choices[0].message.content || "{}");
    } catch (marketingError) {
      console.error("Failed to generate marketing insights:", marketingError);
    }

    console.log("Processing Complete!");
    // Subtitles සහ Marketing Data දෙකම යවනවා
    return NextResponse.json({ subtitles: transcription, marketing: marketingInsights });

  } catch (error: any) {
    console.error("Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}