// src/app/components/OtpModal.tsx
'use client';
import React from 'react';

interface OtpModalProps {
  show: boolean;
  onClose: () => void;
  mobile: string;
  setMobile: (mobile: string) => void;
  otp: string;
  setOtp: (otp: string) => void;
  otpSent: boolean;
  handleSendOtp: () => Promise<void>;
  handleVerifyOtp: () => Promise<void>;
  handleChangeMobile: () => void; // New prop for changing mobile
  message: string;
  isVerifying: boolean;
}

export default function OtpModal({
  show, onClose, mobile, setMobile, otp, setOtp, otpSent,
  handleSendOtp, handleVerifyOtp, handleChangeMobile, message, isVerifying
}: OtpModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Mobile Verification</h2>
        {!otpSent ? (
          <>
            <p className="text-sm text-gray-600 mb-3">Enter your mobile number to receive an OTP for a free calculation.</p>
            <input
              type="tel"
              placeholder="Enter Mobile Number (e.g., 9876543210)"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="border p-2 w-full mb-3 rounded-md"
              disabled={isVerifying}
            />
            <button
              onClick={handleSendOtp}
              disabled={isVerifying || !mobile.match(/^\d{10,15}$/)} // Basic validation for button disable
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 w-full disabled:bg-gray-300"
            >
              {isVerifying ? 'Sending...' : 'Send OTP'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-3">Enter the OTP sent to {mobile}.</p>
            <input
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="border p-2 w-full mb-3 rounded-md"
              disabled={isVerifying}
            />
            <button
              onClick={handleVerifyOtp}
              disabled={isVerifying || !otp}
              className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 w-full disabled:bg-gray-300"
            >
              {isVerifying ? 'Verifying...' : 'Verify OTP & Calculate'}
            </button>
             <button
              onClick={handleChangeMobile} // Use the new prop here
              className="mt-2 text-sm text-blue-500 hover:underline w-full"
              disabled={isVerifying}
            >
              Change mobile number?
            </button>
          </>
        )}
        {message && <p className={`text-sm mt-3 ${message.includes('failed') || message.includes('Error') || message.includes('Invalid') || message.includes('expired') ? 'text-red-500' : 'text-green-500'}`}>{message}</p>}
        <button onClick={onClose} className="mt-4 text-sm text-gray-500 hover:text-gray-700 w-full disabled:bg-gray-300" disabled={isVerifying}>Cancel</button>
      </div>
    </div>
  );
}
