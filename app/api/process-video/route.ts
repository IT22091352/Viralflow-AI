import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';

// 🚀 Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { videoUrl } = await req.json();

    if (!videoUrl) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    console.log("Extracting audio from Cloudinary...");
    
    // Cloudinary Video URL එක MP3 Audio URL එකක් බවට පත් කිරීම (AI එකට ලේසි වෙන්න සහ Data ඉතුරු වෙන්න)
    const audioUrl = videoUrl.replace(/\.[^/.]+$/, ".mp3");
    
    // Audio File එක Buffer එකක් විදිහට Download කරගැනීම
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) throw new Error("Failed to fetch audio from Cloudinary");
    
    const arrayBuffer = await audioResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // OpenAI එකට යවන්න පුළුවන් File Object එකක් හැදීම
    const file = await toFile(buffer, 'audio.mp3', { type: 'audio/mp3' });

    console.log("Sending to OpenAI Whisper for Sinhala Song Transcription...");

    // 🔥 OpenAI Whisper API එකට යැවීම
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "si", // අනිවාර්යයෙන්ම සිංහල (Sinhala) කියලා කියනවා
      response_format: "vtt", // කෙලින්ම VTT format එකෙන්ම ඉල්ලනවා! (Magic!)
    });

    console.log("Transcription Complete!");

    // OpenAI එකෙන් කෙලින්ම VTT format එක දෙන නිසා, අපිට අමුතුවෙන් VTT හදන්න ඕනේ නෑ. 
    // කෙලින්ම ඒක UI එකට යවනවා!
    return NextResponse.json({ subtitles: transcription });

  } catch (error: any) {
    console.error("Transcription Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}