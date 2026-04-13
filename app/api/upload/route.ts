import { v2 as cloudinary } from 'cloudinary';
import { NextRequest, NextResponse } from 'next/server';
export const maxDuration = 60; // process වෙන්න වෙලාව ගන්න නිසා (seconds)
export const dynamic = 'force-dynamic';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  try {
    // Request එක valid ද කියලා බලන්න
    if (!req.body) {
      return NextResponse.json({ error: "No body provided" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert file to buffer for Cloudinary
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { resource_type: "video", folder: "viralflow_uploads" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });

    const videoUrl = (result as any).secure_url;

    // ඊළඟ පියවර: මෙතනදී අපි OpenAI Whisper API එකට videoUrl එක යවන්න ඕනේ
    console.log("Video uploaded to Cloudinary:", videoUrl);

    return NextResponse.json({ 
      message: "Upload successful", 
      url: videoUrl 
    });

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}