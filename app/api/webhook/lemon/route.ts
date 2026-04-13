import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { clerkClient } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  try {
    // Lemon Squeezy එකෙන් එවන data ටික ගන්නවා
    const rawBody = await req.text();
    const signature = req.headers.get('x-signature') as string;
    
    // අපේ .env එකේ තියෙන රහස් කේතය (Secret Key)
    const secret = process.env.LEMON_WEBHOOK_SECRET || '';

    // Security Check: මේක ඇත්තටම එන්නේ Lemon Squeezy එකෙන්ද කියලා බලනවා
    const hmac = crypto.createHmac('sha256', secret);
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (!crypto.timingSafeEqual(digest, signatureBuffer)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Data ටික JSON විදිහට කියවනවා
    const data = JSON.parse(rawBody);

    // Event එක "order_created" (සල්ලි ගෙවලා ඉවරයි) නම් විතරක් වැඩේ කරනවා
    if (data.meta.event_name === 'order_created') {
      const clerkUserId = data.meta.custom_data.user_id;

      if (clerkUserId) {
        console.log(`✅ Payment Successful! Upgrading user: ${clerkUserId}`);
        
        // Clerk එකේ User ව PRO කරනවා
        await (await clerkClient()).users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            isPremium: true, // මේක true වුණ ගමන් UI එකේ ඔක්කොම Unlock වෙනවා!
          }
        });
      }
    }

    return NextResponse.json({ message: 'Webhook received and processed!' });
  } catch (error: any) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}