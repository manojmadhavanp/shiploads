// src/app/api/razorpay/verify-payment-signature/route.ts
// This is an optional step for immediate client feedback. Webhook is the source of truth.
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        if (!keySecret) {
            console.error('Razorpay secret key is not configured.');
            return NextResponse.json({ message: 'Payment verification internal error.', verified: false }, { status: 500 });
        }

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return NextResponse.json({ message: 'Missing payment details for verification.', verified: false }, { status: 400 });
        }

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            // Signature matches.
            // DO NOT update database here based on this client-side check for critical operations like plan upgrade.
            // This endpoint is only for giving quick feedback to the client.
            // The actual plan upgrade should be handled by a secure webhook.
            return NextResponse.json({ message: 'Signature verified successfully (client-side check).', verified: true }, { status: 200 });
        } else {
            return NextResponse.json({ message: 'Invalid signature (client-side check).', verified: false }, { status: 400 });
        }
    } catch (error) {
        console.error('Verify payment signature error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json({ message: 'Failed to verify payment signature.', error: errorMessage, verified: false }, { status: 500 });
    }
}
