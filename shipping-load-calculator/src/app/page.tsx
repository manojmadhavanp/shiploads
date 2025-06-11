// src/app/page.tsx
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)] text-center px-4"> {/* Adjust min-height considering navbar and padding */}
      <header className="mb-12">
        <h1 className="text-5xl font-bold text-gray-800 mb-4">
          Optimize Your Shipping with Smart Load Calculation
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Effortlessly plan your cargo, maximize container space, and reduce shipping costs with our intuitive load calculator.
        </p>
      </header>

      <div className="space-x-4">
        <Link
          href="/load"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg text-lg shadow-md transition duration-150 ease-in-out"
        >
          Calculate Your Load Now
        </Link>
        <Link
          href="/pricing"
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-8 rounded-lg text-lg shadow-md transition duration-150 ease-in-out"
        >
          View Pricing
        </Link>
      </div>

      <section className="mt-16 py-12 bg-white w-full max-w-5xl mx-auto rounded-lg shadow-xl">
        <h2 className="text-3xl font-bold text-gray-700 mb-8">Why Choose Us?</h2>
        <div className="grid md:grid-cols-3 gap-8 px-8">
          <div className="p-6 border border-gray-200 rounded-lg">
            <h3 className="text-xl font-semibold text-blue-600 mb-2">Easy to Use</h3>
            <p className="text-gray-600">Simple item input and intuitive interface.</p>
          </div>
          <div className="p-6 border border-gray-200 rounded-lg">
            <h3 className="text-xl font-semibold text-blue-600 mb-2">Efficient Calculations</h3>
            <p className="text-gray-600">Optimize container space effectively.</p>
          </div>
          <div className="p-6 border border-gray-200 rounded-lg">
            <h3 className="text-xl font-semibold text-blue-600 mb-2">Save Costs</h3>
            <p className="text-gray-600">Reduce wastage and shipping expenses.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
