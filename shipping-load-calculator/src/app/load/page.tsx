// src/app/load/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, FormEvent, useEffect } from 'react';
import OtpModal from '../components/OtpModal';

interface Item { id: string; name: string; length: number; width: number; height: number; weight: number; quantity: number; stackable: boolean; tiltable: boolean; }

// Client-side type for the structure received from /api/load-calc
interface ClientCalculationResult {
  source: 'algorithm' | 'llm';
  plan: Array<{ // This should match ContainerPlanEntrySchema from Zod, plus fastFit's simpler plan
    type: string;
    count: number;
    items?: Array<{ item_name: string; quantity: number }>; // Optional for fastFit plan
    justification?: string; // Optional for fastFit plan, and for LLM's per-container justification
  }>;
  justification?: string; // Top-level justification, mainly for fastFit
  notes?: string; // Optional notes, e.g. if LLM returns empty plan
}


const FREE_PLAN_ITEM_LIMIT_CONST = 10;
const FREE_PLAN_MONTHLY_CALCULATION_LIMIT_CONST = 3;

export default function LoadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [items, setItems] = useState<Item[]>([]);
  const [itemName, setItemName] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [stackable, setStackable] = useState(true);
  const [tiltable, setTiltable] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');

  const [calculationResult, setCalculationResult] = useState<ClientCalculationResult | null>(null); // Updated type
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationError, setCalculationError] = useState('');

  const [showOtpModal, setShowOtpModal] = useState(false);
  const [guestMobile, setGuestMobile] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const [isGuestVerified, setIsGuestVerified] = useState(false);
  const [currentLeadLogId, setCurrentLeadLogId] = useState<string | null>(null);

  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [monthlyUsage, setMonthlyUsage] = useState<number | null>(null);
  const [itemLimit, setItemLimit] = useState<number>(Infinity);
  const [monthlyLimit, setMonthlyLimit] = useState<number>(Infinity);
  const [isLoadingUserDetails, setIsLoadingUserDetails] = useState(false);

  useEffect(() => {
    const fetchUserDetails = async () => {
      if (status === 'authenticated' && session?.user) {
        setIsLoadingUserDetails(true);
        try {
          const res = await fetch('/api/user/usage-details');
          if (res.ok) {
            const data = await res.json();
            setUserPlan(data.subscriptionPlan); setMonthlyUsage(data.monthlyCalculations);
            setItemLimit(data.itemLimit === Infinity ? Infinity : Number(data.itemLimit));
            setMonthlyLimit(data.monthlyLimit === Infinity ? Infinity : Number(data.monthlyLimit));
          } else {
            console.error("Failed to fetch user usage details"); setUserPlan('free'); setMonthlyUsage(0);
            setItemLimit(FREE_PLAN_ITEM_LIMIT_CONST); setMonthlyLimit(FREE_PLAN_MONTHLY_CALCULATION_LIMIT_CONST);
          }
        } catch (e) {
          console.error("Error fetching user details", e); setUserPlan('free'); setMonthlyUsage(0);
          setItemLimit(FREE_PLAN_ITEM_LIMIT_CONST); setMonthlyLimit(FREE_PLAN_MONTHLY_CALCULATION_LIMIT_CONST);
        } finally { setIsLoadingUserDetails(false); }
      } else {
        setUserPlan(null); setMonthlyUsage(null); setItemLimit(Infinity); setMonthlyLimit(Infinity);
      }
    };
    fetchUserDetails();
  }, [status, session]);

  const handleAddItem = (e: FormEvent) => { e.preventDefault(); if (!itemName || !length || !width || !height || !weight || !quantity) { alert('Please fill in all item details.'); return; } const newItem: Item = { id: Date.now().toString(), name: itemName, length: parseFloat(length), width: parseFloat(width), height: parseFloat(height), weight: parseFloat(weight), quantity: parseInt(quantity, 10), stackable, tiltable, }; setItems([...items, newItem]); setItemName(''); setLength(''); setWidth(''); setHeight(''); setWeight(''); setQuantity('1'); setStackable(true); setTiltable(false); };
  const handleRemoveItem = (id: string) => { setItems(items.filter(item => item.id !== id)); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { setFile(e.target.files[0]); setUploadError(''); setUploadSuccess(''); } };
  const handleFileUpload = async () => { if (!file) { setUploadError('Please select a file to upload.'); return; } setUploading(true); setUploadError(''); setUploadSuccess(''); const formData = new FormData(); formData.append('file', file); try { const response = await fetch('/api/upload-items', { method: 'POST', body: formData }); const data = await response.json(); if (!response.ok) { setUploadError(data.message || 'File upload failed.'); } else { if (data.items && Array.isArray(data.items)) { const newItems = data.items.map((item: any) => ({ ...item, id: Date.now().toString() + Math.random().toString(36).substring(2, 9) })); setItems(prevItems => [...prevItems, ...newItems]); setUploadSuccess(`${data.items.length} items added from ${file.name}. Review them below.`); } else { setUploadSuccess(data.message || 'File processed, but no items were extracted.'); } setFile(null); const fileInput = document.getElementById('fileUpload') as HTMLInputElement; if (fileInput) fileInput.value = ''; } } catch (error) { console.error('File upload error:', error); setUploadError('An error occurred during file upload.'); } finally { setUploading(false); } };

  const coreCalculationLogic = async () => {
    setIsCalculating(true); setCalculationResult(null); setCalculationError('');
    try {
      const payload: any = { items };
      if (isGuestVerified && guestMobile) {
        payload.guestMobile = guestMobile;
        if (currentLeadLogId) payload.leadLogId = currentLeadLogId;
      }
      const response = await fetch('/api/load-calc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json(); // data is now { source, plan, justification?, notes? }
      if (!response.ok) {
        setCalculationError(data.message || 'Calculation failed.');
        if (data.reason === 'USAGE_LIMIT_EXCEEDED_GUEST_DAILY' && status !== 'authenticated') {
            setOtpMessage('This mobile number has reached its daily free calculation limit. Please sign up or try again tomorrow.');
            setShowOtpModal(true); setIsGuestVerified(false); setOtpSent(false); setCurrentLeadLogId(null);
        }
      } else {
        setCalculationResult(data); // Store the whole object { source, plan, justification?, notes? }
        setShowOtpModal(false);
        if (isGuestVerified) { setOtpMessage(''); }
        if (status === 'authenticated' && userPlan === 'free') {
            const res = await fetch('/api/user/usage-details'); // Refresh usage
            if (res.ok) { const usageData = await res.json(); setMonthlyUsage(usageData.monthlyCalculations); }
        }
      }
    } catch (error) { console.error('Calculation submission error:', error); setCalculationError('An error occurred during calculation.'); }
    finally { setIsCalculating(false); }
  };

  const handleSubmitCalculation = async () => {
    if (items.length === 0) { alert('Please add at least one item.'); return; }
    if (status === 'authenticated') {
      if (userPlan === 'free') {
        if (items.length > itemLimit) { setCalculationError(`Free plan: Max ${itemLimit} items/calc. You have ${items.length}.`); return; }
        if (monthlyUsage !== null && monthlyUsage >= monthlyLimit) { setCalculationError(`Free plan: Monthly calc limit (${monthlyLimit}) reached.`); return; }
      }
      coreCalculationLogic();
    } else if (isGuestVerified) {
      if (items.length > 5) { alert('Guests are limited to 5 items per calculation. Sign up for more.'); return; }
      coreCalculationLogic();
    } else {
      setShowOtpModal(true); setOtpSent(false); setOtp('');
      setOtpMessage('Verify your mobile to proceed with a guest calculation.');
    }
  };

  const handleSendOtp = async () => { if (!guestMobile.match(/^\d{10,15}$/)) { setOtpMessage('Please enter a valid mobile number.'); return; } setIsCalculating(true); setOtpMessage('Sending OTP...'); try { const res = await fetch('/api/auth/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile: guestMobile }), }); const data = await res.json(); if (!res.ok) { setOtpMessage(data.message || 'Failed to send OTP.'); setOtpSent(false); } else { setOtpMessage(data.message || 'OTP sent.'); setOtpSent(true); } } catch (err) { setOtpMessage('Error sending OTP.'); setOtpSent(false); } finally { setIsCalculating(false); } };
  const handleVerifyOtp = async () => { if (!otp) { setOtpMessage('Please enter the OTP.'); return; } setIsCalculating(true); setOtpMessage('Verifying OTP...'); try { const res = await fetch('/api/auth/verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mobile: guestMobile, otp }), }); const data = await res.json(); if (!res.ok) { setOtpMessage(data.message || 'OTP verification failed.'); setIsGuestVerified(false); setCurrentLeadLogId(null); } else { setOtpMessage(data.message || 'OTP verified successfully!'); setIsGuestVerified(true); setCurrentLeadLogId(data.leadLogId || null); setShowOtpModal(false); coreCalculationLogic(); } } catch (err) { setOtpMessage('Error verifying OTP.'); setIsGuestVerified(false); setCurrentLeadLogId(null); } finally { setIsCalculating(false); } };
  const handleChangeMobileNumberInModal = () => { setOtpSent(false); setOtp(''); setCurrentLeadLogId(null); setOtpMessage('Enter your mobile number.'); };

  if (status === 'loading' && !isGuestVerified && !isLoadingUserDetails) return <p className="text-center py-10">Loading session...</p>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Load Calculator</h1>
      {status === 'authenticated' && userPlan === 'free' && monthlyUsage !== null && !isLoadingUserDetails && (<div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6" role="alert"><p className="font-bold">Free Plan Usage</p><p>Items for current calculation: {items.length} / {itemLimit === Infinity ? 'Unlimited' : itemLimit}.</p><p>Monthly Calculations Used: {monthlyUsage} / {monthlyLimit === Infinity ? 'Unlimited' : monthlyLimit}. {monthlyUsage !== null && monthlyLimit !== null && monthlyUsage >= monthlyLimit && " Please upgrade for more calculations."}</p></div>)}

      {/* Item Input Form */}
      <form onSubmit={handleAddItem} className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Add Item Manually</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div><label htmlFor="itemName" className="block text-sm font-medium text-gray-600">Name</label><input type="text" id="itemName" value={itemName} onChange={(e) => setItemName(e.target.value)} required className="mt-1 p-2 w-full border border-gray-300 rounded-md shadow-sm"/></div>
          <div><label htmlFor="length" className="block text-sm font-medium text-gray-600">Length (cm)</label><input type="number" id="length" value={length} onChange={(e) => setLength(e.target.value)} required className="mt-1 p-2 w-full border border-gray-300 rounded-md shadow-sm"/></div>
          <div><label htmlFor="width" className="block text-sm font-medium text-gray-600">Width (cm)</label><input type="number" id="width" value={width} onChange={(e) => setWidth(e.target.value)} required className="mt-1 p-2 w-full border border-gray-300 rounded-md shadow-sm"/></div>
          <div><label htmlFor="height" className="block text-sm font-medium text-gray-600">Height (cm)</label><input type="number" id="height" value={height} onChange={(e) => setHeight(e.target.value)} required className="mt-1 p-2 w-full border border-gray-300 rounded-md shadow-sm"/></div>
          <div><label htmlFor="weight" className="block text-sm font-medium text-gray-600">Weight (kg)</label><input type="number" id="weight" value={weight} onChange={(e) => setWeight(e.target.value)} required className="mt-1 p-2 w-full border border-gray-300 rounded-md shadow-sm"/></div>
          <div><label htmlFor="quantity" className="block text-sm font-medium text-gray-600">Quantity</label><input type="number" id="quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} min="1" required className="mt-1 p-2 w-full border border-gray-300 rounded-md shadow-sm"/></div>
        </div>
        <div className="flex items-center space-x-4 mb-6"><div className="flex items-center"><input id="stackable" type="checkbox" checked={stackable} onChange={(e) => setStackable(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"/><label htmlFor="stackable" className="ml-2 block text-sm text-gray-900">Stackable</label></div><div className="flex items-center"><input id="tiltable" type="checkbox" checked={tiltable} onChange={(e) => setTiltable(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"/><label htmlFor="tiltable" className="ml-2 block text-sm text-gray-900">Tiltable</label></div></div>
        <button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-md shadow-sm">Add Item to List</button>
      </form>

      {/* File Upload Section */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">Upload Item List</h2>
        <p className="text-sm text-gray-500 mb-2">Supported formats: PDF, XLSX, CSV, JPG, PNG (placeholder parsing logic).</p>
        <div className="flex items-center space-x-2"><input id="fileUpload" type="file" onChange={handleFileChange} accept=".pdf,.xlsx,.csv,.jpeg,.jpg,.png" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/><button onClick={handleFileUpload} disabled={!file || uploading} className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-md shadow-sm disabled:bg-gray-300">{uploading ? 'Uploading...' : 'Upload and Add Items'}</button></div>
        {uploadError && <p className="text-red-500 text-sm mt-2">{uploadError}</p>}
        {uploadSuccess && <p className="text-green-500 text-sm mt-2">{uploadSuccess}</p>}
      </div>

      {/* Item List Table */}
      {items.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-700">Item List (Preview)</h2>
          <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dims (LxWxH cm)</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight (kg)</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stackable</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tiltable</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{items.map(item => (<tr key={item.id}><td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.name}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{`${item.length}x${item.width}x${item.height}`}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.weight}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.quantity}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.stackable ? 'Yes' : 'No'}</td><td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{item.tiltable ? 'Yes' : 'No'}</td><td className="px-4 py-2 whitespace-nowrap text-sm"><button onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700 font-medium">Remove</button></td></tr>))}</tbody></table></div>
          <div className="mt-6 text-right"><button onClick={handleSubmitCalculation} disabled={isCalculating || items.length === 0 || (status === 'authenticated' && userPlan === 'free' && (items.length > itemLimit || (monthlyUsage !== null && monthlyUsage >= monthlyLimit)))} className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-md disabled:bg-gray-400">{isCalculating ? 'Processing...' : 'Confirm and Calculate Load'}</button></div>
        </div>
      )}

      {/* Calculation Result Display */}
      {isCalculating && !calculationResult && <p className="text-center py-4 text-blue-600 font-semibold">Calculating your load...</p>}
      {calculationError && <p className="text-center py-4 text-red-500 font-semibold">Error: {calculationError}</p>}

      {calculationResult && (
        <div className="mt-8 bg-green-50 p-6 rounded-lg shadow-md border border-green-200">
          <h2 className="text-2xl font-bold mb-4 text-green-700">Calculation Result</h2>
          <p className="text-sm text-gray-600 mb-1">
            Source: <span className="font-semibold">{calculationResult.source === 'algorithm' ? 'Fast-Fit Algorithm' : 'LLM (OpenAI)'}</span>
          </p>
          {calculationResult.source === 'algorithm' && calculationResult.justification && (
            <p className="text-gray-700 mb-2"><strong className="font-semibold">Justification (Algorithm):</strong> {calculationResult.justification}</p>
          )}
          {calculationResult.notes && (
            <p className="text-gray-700 mb-2 italic"><strong className="font-semibold">Notes:</strong> {calculationResult.notes}</p>
          )}

          <h3 className="text-lg font-semibold mt-3 mb-1 text-gray-700">Container Plan:</h3>
          {calculationResult.plan && calculationResult.plan.length > 0 ? (
            <ul className="list-none space-y-3">
              {calculationResult.plan.map((containerEntry: any, index: number) => (
                <li key={index} className="p-3 border rounded-md bg-white shadow">
                  <p className="font-semibold text-blue-700">{containerEntry.count} x {containerEntry.type}</p>
                  {/* Display per-container justification if from LLM and present */}
                  {calculationResult.source === 'llm' && containerEntry.justification && (
                    <p className="text-xs text-gray-500 mt-1 mb-1"><em>Justification (LLM): {containerEntry.justification}</em></p>
                  )}
                  {/* Display items if present in the container entry (typically from LLM) */}
                  {containerEntry.items && containerEntry.items.length > 0 && (
                    <div className="ml-4 mt-1">
                      <p className="text-xs font-medium text-gray-600">Contains (example):</p>
                      <ul className="list-disc list-inside text-xs text-gray-500">
                        {containerEntry.items.slice(0, 5).map((item: any, itemIdx: number) => (
                          <li key={itemIdx}>{item.item_name} (Qty: {item.quantity})</li>
                        ))}
                        {containerEntry.items.length > 5 && <li>...and {containerEntry.items.length - 5} more items.</li>}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600">No specific container plan was detailed or the plan is empty.</p>
          )}
        </div>
      )}

      <OtpModal show={showOtpModal} onClose={() => { setShowOtpModal(false); setOtpMessage(''); if (!isGuestVerified) { setCurrentLeadLogId(null); } }} mobile={guestMobile} setMobile={setGuestMobile} otp={otp} setOtp={setOtp} otpSent={otpSent} handleSendOtp={handleSendOtp} handleVerifyOtp={handleVerifyOtp} handleChangeMobile={handleChangeMobileNumberInModal} message={otpMessage} isVerifying={isCalculating} />
    </div>
  );
}
