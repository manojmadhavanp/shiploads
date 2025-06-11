// src/app/api/user/usage-details/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

const FREE_PLAN_ITEM_LIMIT = 10; // Ensure this is consistent
const FREE_PLAN_MONTHLY_CALCULATION_LIMIT = 3; // Ensure this is consistent

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  const userId = (session.user as any).id;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthlyCalculations = await prisma.report.count({
      where: {
        userId: userId,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    return NextResponse.json({
      subscriptionPlan: user.subscriptionPlan,
      monthlyCalculations: monthlyCalculations,
      monthlyLimit: user.subscriptionPlan === 'free' ? FREE_PLAN_MONTHLY_CALCULATION_LIMIT : Infinity, // Pro plan has effectively no limit shown here
      itemLimit: user.subscriptionPlan === 'free' ? FREE_PLAN_ITEM_LIMIT : Infinity, // Pro plan has effectively no limit shown here
      lifetimeCalculations: user.usageCount
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching user usage details:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
