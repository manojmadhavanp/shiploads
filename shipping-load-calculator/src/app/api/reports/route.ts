// src/app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !(session.user as any).id) {
    return NextResponse.json({ message: 'Unauthorized: User ID not found in session.' }, { status: 401 });
  }
  const userId = (session.user as any).id;

  try {
    const reports = await prisma.report.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      select: { // Select only necessary fields to keep payload small
        id: true,
        createdAt: true,
        result: true, // Contains summary, container types, totalItems, etc.
        items: true, // For a quick count or brief display if needed
      }
    });

    // Process reports to add a summary if not directly available or to format
    const processedReports = reports.map(report => {
        const resultData = report.result as any; // Cast because Prisma returns JsonValue
        const itemsData = report.items as any[];
        return {
            id: report.id,
            createdAt: report.createdAt,
            summary: resultData?.summary || 'No summary available',
            containerInfo: `${resultData?.containerCounts?.join(', ')} x ${resultData?.containerTypes?.join(', ')}`,
            totalItems: resultData?.totalItems || itemsData?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 'N/A',
            totalWeight: resultData?.totalWeight ? `${resultData.totalWeight} kg` : 'N/A',
            totalVolume: resultData?.totalVolumeCubicMeters ? `${resultData.totalVolumeCubicMeters} m³` : 'N/A',
        };
    });

    return NextResponse.json({ reports: processedReports }, { status: 200 });

  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ message: 'Internal server error while fetching reports.' }, { status: 500 });
  }
}
