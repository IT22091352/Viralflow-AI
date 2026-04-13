import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    // UI එකෙන් video URL එක ගන්නවා
    const { videoUrl } = await req.json();

    if (!videoUrl) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    const selectedLanguage = 'en';

    console.log("Extracting audio from Cloudinary...");

    const audioUrls = [
      videoUrl.replace('/upload/', '/upload/f_mp3/'),
      videoUrl.replace(/\.[^/.?]+(?=\?|$)/, '.mp3'),
      videoUrl,
    ];

    let audioResponse: Response | null = null;
    let lastError: string | null = null;

    for (const candidateUrl of audioUrls) {
      const res = await fetch(candidateUrl);
      if (res.ok) {
        audioResponse = res;
        break;
      }
      lastError = `Failed fetching audio source: ${candidateUrl} (${res.status})`;
    }

    if (!audioResponse) {
      throw new Error(lastError || 'Failed to fetch audio from Cloudinary');
    }

    const arrayBuffer = await audioResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const file = await toFile(buffer, 'audio.mp3', { type: 'audio/mp3' });

    console.log(`Sending to OpenAI Whisper... (Language Mode: ${selectedLanguage})`);

    // 🟢 AI එකට යවන Settings හදනවා
    const whisperParams: any = {
      file: file,
      model: "whisper-1",
      response_format: "vtt",
      temperature: 0,
    };

    // English-only version සඳහා Whisper එකට explicit English language setting දෙන්නවා.
    whisperParams.language = "en";

    let transcription: any;
    try {
      transcription = await openai.audio.transcriptions.create(whisperParams);
    } catch (error: any) {
      // Guardrail: future config වෙනස්වීමකින් unsupported language දාලා crash වුණොත් retry via auto-detect.
      if (error?.code === 'unsupported_language' || /unsupported language/i.test(error?.message || '')) {
        const fallbackParams: any = {
          ...whisperParams,
        };
        delete fallbackParams.language;
        fallbackParams.prompt = "Transcribe the audio accurately in English.";
        transcription = await openai.audio.transcriptions.create(fallbackParams);
      } else {
        throw error;
      }
    }

    console.log("Transcription Complete!");
    return NextResponse.json({ subtitles: transcription });

  } catch (error: any) {
    console.error("Transcription Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}