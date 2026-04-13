import { NextRequest, NextResponse } from 'next/server';
import { AssemblyAI } from 'assemblyai';

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!
});

export async function POST(req: NextRequest) {
  try {
    const { videoUrl } = await req.json();

    if (!videoUrl) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    console.log("Sending Video URL directly to AssemblyAI...");

    // 1. Cloudinary URL එක යවනවා
    // "speech_models" Array එකක් විදිහට දිය යුතුයි
    const transcript = await client.transcripts.transcribe({
      audio_url: videoUrl,
      speech_models: ["universal-2"], 
    });

    if (transcript.status === 'error') {
       throw new Error(transcript.error);
    }

    console.log("Transcription Complete! Generating VTT...");

    // 2. VTT format එකෙන් Subtitles ටික ඉල්ලගමු (අලුත් ක්‍රමය)
    const vtt = await client.transcripts.subtitles(transcript.id, "vtt");

    console.log("AssemblyAI Success! ✅");

    return NextResponse.json({ subtitles: vtt });

  } catch (error: any) {
    console.error("AssemblyAI Error:", error);
    return NextResponse.json({ 
      error: "Failed to generate subtitles. " + (error.message || "")
    }, { status: 500 });
  }
}