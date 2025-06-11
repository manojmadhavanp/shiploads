// src/app/api/auth/verify-otp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { otpStore } from '@/lib/otpStore';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { mobile, otp } = await req.json();
    if (!mobile || !otp) return NextResponse.json({ message: 'Mobile and OTP required.' }, { status: 400 });

    const storedEntry = otpStore[mobile];
    if (!storedEntry) return NextResponse.json({ message: 'Request OTP first or OTP might have been cleared after a previous attempt.' }, { status: 400 });
    if (Date.now() > storedEntry.expiresAt) {
      delete otpStore[mobile];
      return NextResponse.json({ message: 'OTP expired.' }, { status: 400 });
    }

    if (storedEntry.otp === otp) {
      delete otpStore[mobile]; // Clear OTP after successful verification

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0); // Start of UTC day
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(today.getUTCDate() + 1); // Start of next UTC day

      let leadLog = await prisma.leadLog.findFirst({
        where: {
          mobileNumber: mobile,
          attemptedAt: { gte: today, lt: tomorrow },
        },
        orderBy: { attemptedAt: 'desc' }
      });

      if (leadLog) {
        leadLog = await prisma.leadLog.update({
          where: { id: leadLog.id },
          data: { otpVerified: true, otpVerifiedAt: new Date(), notes: (leadLog.notes || '') + ' OTP verification successful.' },
        });
      } else {
        leadLog = await prisma.leadLog.create({
          data: {
            mobileNumber: mobile,
            attemptedAt: new Date(), // This marks OTP process initiation
            otpVerified: true,
            otpVerifiedAt: new Date(),
            notes: 'OTP verification successful.',
          },
        });
      }

      return NextResponse.json({ message: 'OTP verified successfully.', leadLogId: leadLog.id }, { status: 200 });
    } else {
      // Do not delete OTP on invalid attempt, allow retry until expiry
      return NextResponse.json({ message: 'Invalid OTP.' }, { status: 400 });
    }
  } catch (error) {
    console.error('Verify OTP Error:', error);
    return NextResponse.json({ message: 'Error verifying OTP.' }, { status: 500 });
  }
}
