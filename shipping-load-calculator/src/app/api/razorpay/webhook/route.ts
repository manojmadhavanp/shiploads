// src/app/api/razorpay/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
// import Razorpay from 'razorpay'; // Not strictly needed for webhook verification if not fetching order details

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-razorpay-signature');
  const rawBody = await req.text();

  if (!WEBHOOK_SECRET) {
    console.error('Razorpay webhook secret not configured.');
    return NextResponse.json({ message: 'Webhook secret not configured.' }, { status: 500 });
  }

  if (!signature) {
    console.warn('Webhook request missing signature.');
    return NextResponse.json({ message: 'Signature missing.' }, { status: 400 });
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.warn('Invalid webhook signature.');
      return NextResponse.json({ message: 'Invalid signature.' }, { status: 403 });
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'payment.captured' || event.event === 'order.paid') {
      const paymentOrOrder = event.event === 'payment.captured' ? event.payload.payment.entity : event.payload.order.entity;
      const orderId = paymentOrOrder.order_id || paymentOrOrder.id; // order.paid has 'id', payment.captured has 'order_id'
      const userId = paymentOrOrder.notes?.userId;

      if (!userId) {
        console.error(`Webhook Error (${event.event}): userId not found in notes for order_id:`, orderId);
        return NextResponse.json({ message: 'User ID missing in payment/order notes.' }, { status: 200 }); // Ack to Razorpay
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        console.error(`Webhook Error (${event.event}): User not found for userId:`, userId, 'order_id:', orderId);
        return NextResponse.json({ message: 'User not found.' }, { status: 200 }); // Ack to Razorpay
      }

      // Only update if not already 'pro', to handle potential webhook retries or multiple events
      if (user.subscriptionPlan !== 'pro') {
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionPlan: 'pro',
            // Optionally: set subscriptionStartDate, endDate, paymentGatewayCustomerId, etc.
            // paymentGatewayCustomerId: paymentOrOrder.customer_id,
          },
        });
        console.log(`User ${user.email} (ID: ${userId}) subscription updated to 'pro' via ${event.event} for order ${orderId}.`);
      } else {
        console.log(`User ${user.email} (ID: ${userId}) is already on Pro plan. Webhook for order ${orderId} (${event.event}) processed, no change.`);
      }

    } else {
      console.log('Received Razorpay webhook event:', event.event, '- not actively handled for subscription update.');
    }

    return NextResponse.json({ message: 'Webhook received successfully.' }, { status: 200 });

  } catch (error) {
    console.error('Error processing Razorpay webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error processing webhook.';
    return NextResponse.json({ message: 'Error processing webhook.', error: errorMessage }, { status: 500 });
  }
}
