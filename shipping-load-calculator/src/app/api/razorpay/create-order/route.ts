// src/app/api/razorpay/create-order/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma'; // To get user email for receipt

const PRO_PLAN_AMOUNT_PAISA = 1999; // e.g., Rs 19.99 (1999 paisa)
const PRO_PLAN_CURRENCY = 'INR';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as any).id;
  const userEmail = session.user.email;

  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const options = {
      amount: PRO_PLAN_AMOUNT_PAISA,
      currency: PRO_PLAN_CURRENCY,
      receipt: `receipt_pro_${userId}_${Date.now()}`, // Unique receipt ID
      notes: {
        userId: userId,
        plan: 'pro',
        userEmail: userEmail || '',
      },
    };

    const order = await razorpay.orders.create(options);

    if (!order) {
      return NextResponse.json({ message: 'Error creating Razorpay order.' }, { status: 500 });
    }

    // Optionally, store this order_id with user status 'pending_payment' in your DB
    // For example: await prisma.user.update({ where: {id: userId}, data: { razorpayOrderId: order.id }});

    return NextResponse.json({ order }, { status: 200 });

  } catch (error) {
    console.error('Razorpay order creation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Failed to create Razorpay order.', error: errorMessage }, { status: 500 });
  }
}
