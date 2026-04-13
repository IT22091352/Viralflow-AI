import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Cloudinary Configuration - Variables හරියටම Map කිරීම
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // <--- මෙතන වෙනස් කළා
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  try {
    const { vttText } = await req.json();

    if (!vttText) {
       return NextResponse.json({ error: "No VTT text provided" }, { status: 400 });
    }

    console.log("Uploading Subtitles to Cloudinary...");

    // VTT content එක Base64 කරලා upload කරමු
    const base64Vtt = Buffer.from(vttText).toString('base64');
    const uploadStr = `data:text/vtt;base64,${base64Vtt}`;

    const result = await cloudinary.uploader.upload(uploadStr, {
      resource_type: 'raw',
      folder: 'viralflow_subtitles',
      public_id: `sub_${Date.now()}.vtt`
    });

    console.log("Subtitles Uploaded Successfully! ✅ ID:", result.public_id);

    return NextResponse.json({ subtitleId: result.public_id });
  } catch (error: any) {
    console.error("Cloudinary VTT Upload Error Detail:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}