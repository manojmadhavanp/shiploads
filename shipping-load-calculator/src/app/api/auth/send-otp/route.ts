// src/app/api/auth/send-otp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { otpStore } from '@/lib/otpStore'; // Import shared OTP store

export async function POST(req: NextRequest) {
  try {
    const { mobile } = await req.json();
    if (!mobile || !mobile.match(/^\d{10,15}$/)) { // Basic validation
      return NextResponse.json({ message: 'Valid mobile number is required.' }, { status: 400 });
    }

    const mockOtp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate a random 6-digit number
    const expiryTime = Date.now() + 10 * 60 * 1000; // OTP valid for 10 minutes

    otpStore[mobile] = { otp: mockOtp, expiresAt: expiryTime };

    console.log(`Mock OTP for ${mobile}: ${mockOtp}`); // For dev purposes

    // In a real app, you'd integrate with an SMS gateway here.
    // e.g., await sendSms(mobile, `Your OTP is ${mockOtp}`);

    return NextResponse.json({ message: `Mock OTP sent to ${mobile}. (Dev: ${mockOtp})` }, { status: 200 });
  } catch (error) {
    console.error('Send OTP Error:', error);
    return NextResponse.json({ message: 'Error sending OTP.' }, { status: 500 });
  }
}
