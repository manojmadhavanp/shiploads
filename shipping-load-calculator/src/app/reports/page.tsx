// src/app/reports/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

interface ReportItem {
  id: string;
  createdAt: string; // Or Date
  summary: string;
  containerInfo: string;
  totalItems: number | string;
  totalWeight: string;
  totalVolume: string;
}

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/reports');
    } else if (status === 'authenticated') {
      const fetchReports = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch('/api/reports');
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch reports');
          }
          const data = await response.json();
          setReports(data.reports);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setIsLoading(false);
        }
      };
      fetchReports();
    }
  }, [status, router]);

  if (status === 'loading' || isLoading) {
    return <p className="text-center py-10">Loading reports...</p>;
  }

  if (!session) {
     // Should be caught by status === 'unauthenticated' and redirect
    return <p className="text-center py-10 text-red-500">Access Denied. Please sign in.</p>;
  }

  if (error) {
    return <p className="text-center py-10 text-red-500">Error loading reports: {error}</p>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Calculation History</h1>

      {reports.length === 0 ? (
        <p className="text-center text-gray-600">You have not made any calculations yet.</p>
      ) : (
        <div className="overflow-x-auto bg-white p-6 rounded-lg shadow-md">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Summary</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Containers</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volume</th>
                {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th> */}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reports.map((report) => (
                <tr key={report.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {new Date(report.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-normal text-sm text-gray-700 max-w-xs break-words">{report.summary}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{report.containerInfo}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{report.totalItems}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{report.totalWeight}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{report.totalVolume}</td>
                  {/* <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-indigo-600 hover:text-indigo-900">View Details</button>
                  </td> */}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
