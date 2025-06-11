// src/app/components/Navbar.tsx
'use client';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

export default function Navbar() {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';

  return (
    <nav className="bg-gray-800 text-white p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">
          ShipCalc
        </Link>
        <div className="flex items-center space-x-4">
          {isLoading ? (
            <p>Loading...</p>
          ) : session?.user ? (
            <>
              <Link href="/load" className="hover:text-gray-300">Calculate Load</Link>
              <Link href="/reports" className="hover:text-gray-300">My Reports</Link>
              <span className="text-sm">Signed in as {session.user.email}</span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-sm"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/signin" className="hover:text-gray-300">
                Sign In
              </Link>
              <Link href="/auth/signup" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
