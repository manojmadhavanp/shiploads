// src/app/api/load-calc/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { calculateContainers as callLLM } from '@/lib/openai'; // LLM function
import { ItemsArraySchema, Item, CalculationPlan as LLMCalculationPlan } from '@/lib/zodSchemas';
import { fastFit, FastFitResult } from '@/lib/fastFit'; // Import fastFit

// Helper function for date comparison (ensure it's defined or imported if used elsewhere too)
function isSameDayUTC(date1: Date, date2: Date): boolean {
  return date1.getUTCFullYear() === date2.getUTCFullYear() &&
         date1.getUTCMonth() === date2.getUTCMonth() &&
         date1.getUTCDate() === date2.getUTCDate();
}
const FREE_PLAN_ITEM_LIMIT = 10;
const FREE_PLAN_MONTHLY_CALCULATION_LIMIT = 3;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const body = await req.json();
  // Ensure items are validated against Zod schema before use
  const { items: rawItems, guestMobile: guestMobileNumberFromRequest, leadLogId: clientLeadLogId } = body;

  const itemsValidation = ItemsArraySchema.safeParse(rawItems);
  if (!itemsValidation.success) {
    return NextResponse.json({ message: 'Invalid items data format.', errors: itemsValidation.error.flatten() }, { status: 400 });
  }
  const items: Item[] = itemsValidation.data; // Use Zod-validated items

  if (items.length === 0) {
    return NextResponse.json({ message: 'No items provided for calculation.' }, { status: 400 });
  }

  const currentAttemptTime = new Date();
  let finalPlanData: any; // This will hold the structure for Report.result and client response
  let calculationSource: "algorithm" | "llm";

  // --- START Hybrid Calculation ---
  const fastFitAttempt = fastFit(items);

  if (fastFitAttempt.matched) {
    finalPlanData = {
        source: "algorithm",
        plan: fastFitAttempt.plan, // fastFit.plan is Array<{type, count}>
        justification: fastFitAttempt.justification
    };
    calculationSource = "algorithm";
    console.log("Calculation handled by fastFit heuristic.");
  } else {
    console.log("fastFit heuristic did not find a single container solution, delegating to LLM.");
    try {
      const llmPlanResult: LLMCalculationPlan = await callLLM(items); // LLMCalculationPlan is Array<ContainerPlanEntrySchema>
      finalPlanData = {
          source: "llm",
          plan: llmPlanResult
          // Justification from LLM is per container type, so it's part of llmPlanResult items.
          // No top-level justification from LLM in current setup.
      };
      calculationSource = "llm";
      if (llmPlanResult.length === 0 && items.length > 0) {
        console.warn("LLM returned an empty plan for non-empty items.");
        finalPlanData.notes = "LLM returned an empty plan. This might indicate items are too complex or an issue with AI understanding.";
      }
    } catch (llmError: any) {
      console.error("LLM Calculation Error in API route:", llmError);
      return NextResponse.json({ message: `AI Container Calculation Failed: ${llmError.message || 'Unknown error'}` }, { status: 500 });
    }
  }
  // --- END Hybrid Calculation ---

  try {
    // Guest User Flow / Authenticated User Flow (saves finalPlanData to Report.result)
    if (guestMobileNumberFromRequest) {
      let leadLog: import('@prisma/client').LeadLog | null = null;
      if (clientLeadLogId) {
        leadLog = await prisma.leadLog.findUnique({ where: { id: clientLeadLogId }});
        if (leadLog && leadLog.mobileNumber !== guestMobileNumberFromRequest) {
          return NextResponse.json({ message: 'Invalid request data (mismatched lead log).'}, { status: 400 });
        }
      }
      if (!leadLog) {
         const todayUTC = new Date(); todayUTC.setUTCHours(0,0,0,0);
         const tomorrowUTC = new Date(todayUTC); tomorrowUTC.setUTCDate(todayUTC.getUTCDate() + 1);
         leadLog = await prisma.leadLog.findFirst({
            where: { mobileNumber: guestMobileNumberFromRequest, otpVerified: true, attemptedAt: { gte: todayUTC, lt: tomorrowUTC }},
            orderBy: { attemptedAt: 'desc' }
         });
         if (!leadLog) { // If still no leadLog, create one
            leadLog = await prisma.leadLog.create({
                data: { mobileNumber: guestMobileNumberFromRequest, attemptedAt: currentAttemptTime, otpVerified: true, otpVerifiedAt: currentAttemptTime, notes: "LeadLog created at calculation (no matching client ID or prior log for today)." }
            });
         }
      }
      // Update the leadLog with calculation attempt time
      leadLog = await prisma.leadLog.update({ // Re-assign to get potentially updated notes or ensure it's not null
          where: { id: leadLog.id },
          data: { calculationAttemptedAt: currentAttemptTime, otpVerified: true, otpVerifiedAt: leadLog.otpVerifiedAt || currentAttemptTime }
      });

      const guestUsage = await prisma.guestUsage.findUnique({ where: { mobileNumber: guestMobileNumberFromRequest } });
      let allowCalculation = false;
      if (!guestUsage || !isSameDayUTC(guestUsage.calculationPerformedAt, currentAttemptTime)) {
        allowCalculation = true;
        if (!guestUsage) await prisma.guestUsage.create({ data: { mobileNumber: guestMobileNumberFromRequest, calculationPerformedAt: currentAttemptTime } });
        else await prisma.guestUsage.update({ where: { mobileNumber: guestMobileNumberFromRequest }, data: { calculationPerformedAt: currentAttemptTime } });
      }

      if (allowCalculation) {
        const report = await prisma.report.create({ data: { guestMobileNumber: guestMobileNumberFromRequest, items: items as any, result: finalPlanData as any, leadLog: { connect: { id: leadLog.id } } } });
        await prisma.leadLog.update({ where: { id: leadLog.id }, data: { calculationAllowed: true, reportId: report.id, notes: (leadLog.notes || "") + ` Calc by ${calculationSource} allowed.` } });
        return NextResponse.json(finalPlanData, { status: 200 });
      } else {
        await prisma.leadLog.update({ where: { id: leadLog.id }, data: { calculationAllowed: false, notes: (leadLog.notes || "") + ` Daily guest limit (${calculationSource} calc attempt).` } });
        return NextResponse.json({ message: 'Daily free calculation limit reached.', reason: 'USAGE_LIMIT_EXCEEDED_GUEST_DAILY' }, { status: 429 });
      }

    } else if (session?.user && (session.user as any).id) {
      const userId = (session.user as any).id;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return NextResponse.json({ message: 'User not found.' }, { status: 404 });

      if (user.subscriptionPlan === 'free') {
        if (items.length > FREE_PLAN_ITEM_LIMIT) return NextResponse.json({ message: `Free plan: Max ${FREE_PLAN_ITEM_LIMIT} items.`, reason: 'USAGE_LIMIT_ITEMS_EXCEEDED' }, { status: 403 });
        const thirtyDaysAgo = new Date(currentAttemptTime); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const monthlyCalculations = await prisma.report.count({ where: { userId: userId, createdAt: { gte: thirtyDaysAgo } } });
        if (monthlyCalculations >= FREE_PLAN_MONTHLY_CALCULATION_LIMIT) return NextResponse.json({ message: `Free plan: Monthly calc limit (${FREE_PLAN_MONTHLY_CALCULATION_LIMIT}) reached.`, reason: 'USAGE_LIMIT_MONTHLY_CALCS_EXCEEDED' }, { status: 403 });
      }

      await prisma.report.create({ data: { userId: userId, items: items as any, result: finalPlanData as any } });
      await prisma.user.update({ where: { id: userId }, data: { usageCount: { increment: 1 } } });
      return NextResponse.json(finalPlanData, { status: 200 });
    } else {
      return NextResponse.json({ message: 'Unauthorized: No valid session or guest identifier.' }, { status: 401 });
    }
  } catch (error: any) {
    console.error('Load Calc API General Error (Outer Catch):', error);
    let message = 'Internal server error during load calculation.';
    if (error.message && error.message.toLowerCase().includes("zod validation failed")) {
        message = "AI returned an unexpected data format for the calculation plan. Please try again.";
    } else if (error.message && error.message.toLowerCase().includes("openai")) {
        message = "There was an issue with the AI calculation service. Please try again later.";
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}
