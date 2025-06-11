// src/app/pricing/page.tsx
'use client';

import Link from 'next/link';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import Script from 'next/script';
import { useSession, signIn } from 'next-auth/react';
import { useState, useEffect }    from 'react'; // Added useEffect

const features = {
    free: [ 'Up to 10 items per list', '3 calculations per month', 'Basic container suggestions', 'Community support', ],
    pro: [ 'Unlimited items per list', 'Unlimited calculations', 'Advanced container optimization', 'File uploads (PDF, XLSX, CSV)', 'Report history', 'Priority email support', ],
};

export default function PricingPage() {
  const { data: session, status, update: updateSession } = useSession(); // Added updateSession
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  // Local state for subscription plan to allow optimistic update or reflect session
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      setCurrentPlan((session.user as any).subscriptionPlan || 'free');
    } else if (status === 'unauthenticated') {
      setCurrentPlan('free'); // Default for guests or logged out
    }
  }, [session, status]);


  const handleUpgradePro = async () => {
    if (status === 'unauthenticated') {
      signIn('credentials', { callbackUrl: '/pricing?action=upgrade' });
      return;
    }
    if (status === 'loading' || !session?.user) {
        alert("Session still loading or user not found. Please wait and try again.");
        return;
    }
    // Check if already pro from local/session state
    if (currentPlan === 'pro') {
        alert(You are already on the Pro plan!);
        return;
    }

    setIsLoadingPayment(true);
    setPaymentError(null);

    try {
      const response = await fetch('/api/razorpay/create-order', { method: 'POST' });
      const data = await response.json();

      if (!response.ok || !data.order) {
        setPaymentError(data.message || 'Could not initiate payment.');
        setIsLoadingPayment(false);
        return;
      }
      const order = data.order;

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount.toString(),
        currency: order.currency,
        name: 'ShipCalc Pro Plan',
        description: 'Monthly Subscription',
        order_id: order.id,
        handler: async function (paymentResponse: any) {
          // Client-side verification for immediate feedback (optional)
          const verifyRes = await fetch('/api/razorpay/verify-payment-signature', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  razorpay_order_id: paymentResponse.razorpay_order_id,
                  razorpay_payment_id: paymentResponse.razorpay_payment_id,
                  razorpay_signature: paymentResponse.razorpay_signature,
              }),
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok && verifyData.verified) {
              alert('Payment successful (client-side check)! Your plan will be updated after webhook confirmation.');
              // Optimistically update UI or wait for session update from webhook processing
              // To see change immediately, could trigger session update if NextAuth supports it well,
              // or set local state and wait for session to catch up.
              setCurrentPlan('pro'); // Optimistic update for UI
              await updateSession(); // Request session update from NextAuth
          } else {
              alert(`Payment successful, but client-side verification failed: ${verifyData.message}. Please contact support if your plan is not updated.`);
          }
        },
        prefill: {
          name: (session?.user?.name || '') as string,
          email: (session?.user?.email || '') as string,
          contact: ((session?.user as any)?.mobile || '') as string,
        },
        notes: {
          userId: (session?.user as any)?.id,
          plan: 'pro',
        },
        theme: {
          color: '#3B82F6',
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        setPaymentError(
          `Payment failed. Code: ${response.error.code}. Description: ${response.error.description}.`
        );
      });
      rzp.open();

    } catch (err) {
      console.error('Upgrade to Pro error:', err);
      setPaymentError('An unexpected error occurred while setting up payment.');
    } finally {
      setIsLoadingPayment(false);
    }
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="min-h-[calc(100vh-150px)] py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
            Find the Perfect Plan for Your Needs
          </h1>
          <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
            Start for free, or unlock powerful features with our Pro plan to supercharge your load calculations.
          </p>
        </div>
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8 items-start">
            {/* Free Plan Card */}
            <div className="bg-white rounded-xl shadow-2xl p-8">
              <h2 className="text-3xl font-bold text-gray-900">Free</h2>
              <p className="mt-2 text-lg text-gray-500">For individuals and small tests.</p>
              <p className="mt-6 text-5xl font-extrabold text-gray-900">$0<span className="text-xl font-medium text-gray-500">/mo</span></p>
              <Link
                href="/load"
                className="mt-8 block w-full bg-gray-200 hover:bg-gray-300 text-gray-800 text-center py-3 px-6 rounded-lg font-semibold text-lg"
              > Start Calculating (Free) </Link>
              <ul className="mt-8 space-y-3"> {features.free.map((feature) => ( <li key={feature} className="flex items-start"> <CheckCircleIcon className="flex-shrink-0 h-6 w-6 text-green-500 mr-2" /> <span className="text-gray-700">{feature}</span> </li> ))} </ul>
            </div>

            {/* Pro Plan Card */}
            <div className="bg-blue-600 rounded-xl shadow-2xl p-8 text-white relative overflow-hidden">
              <span className="absolute top-0 right-0 bg-yellow-400 text-blue-700 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-bl-lg"> Most Popular </span>
              <h2 className="text-3xl font-bold">Pro</h2>
              <p className="mt-2 text-lg text-blue-100">For professionals and businesses.</p>
              <p className="mt-6 text-5xl font-extrabold">$19<span className="text-sm font-medium text-blue-100">.99/mo</span></p>
              <button
                onClick={handleUpgradePro}
                disabled={isLoadingPayment || status === 'loading' || currentPlan === 'pro'}
                className="mt-8 block w-full bg-white hover:bg-blue-50 text-blue-600 text-center py-3 px-6 rounded-lg font-semibold text-lg disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoadingPayment ? 'Processing...' :
                 currentPlan === 'pro' ? 'You are on Pro Plan' : 'Upgrade to Pro'}
              </button>
              {paymentError && <p className="text-red-200 text-sm mt-2">{paymentError}</p>}
              <ul className="mt-8 space-y-3"> {features.pro.map((feature) => ( <li key={feature} className="flex items-start"> <CheckCircleIcon className="flex-shrink-0 h-6 w-6 text-green-300 mr-2" /> <span>{feature}</span> </li> ))} </ul>
            </div>
        </div>
      </div>
    </>
  );
}
