# ShipCalc: AI-Powered Shipping Load Calculator

ShipCalc is a modern web application designed to help users optimize their shipping load by calculating the most efficient way to pack items into various container types. It features manual item input, file-based item list uploads (PDF, CSV, TXT) with AI-powered data extraction, and a hybrid calculation engine to suggest container plans. The application supports user authentication, guest access with OTP verification, subscription plans (Free/Pro via Razorpay), and report history.

## Key Features

- **User Authentication**: Secure sign-up and sign-in with NextAuth.js (Credentials provider).
- **Guest Access**: OTP-verified guest access for daily calculations.
- **Item Input**:
    - Manual entry of item details (dimensions, weight, quantity, properties).
    - File upload (PDF, TXT, CSV supported for text extraction; AI parsing for extracted text) for automatic item list creation.
- **Hybrid Calculation Engine**: Utilizes a rapid `fastFit` heuristic for simple, single-container solutions, falling back to an advanced LLM (OpenAI GPT-4o mini or similar) for complex multi-item, multi-container planning. Calculation responses are tagged with their source (`algorithm` or `llm`).
- **Subscription Tiers**:
    - **Free Tier**: Limited items per calculation (e.g., 10), limited monthly calculations (e.g., 3).
    - **Pro Tier**: Unlimited items and calculations (requires Razorpay subscription).
    - **Guest**: Daily limit for calculations (e.g., 1 per day after OTP verification).
- **Payment Integration**: Razorpay for handling Pro plan subscriptions, including order creation and webhook verification for plan updates.
- **Report History**: Authenticated users can view their past calculation reports.
- **Lead Logging**: Tracks guest interactions (OTP verification, calculation attempts) for analytics and usage control.
- **Responsive UI**: Built with Next.js (App Router) and Tailwind CSS.
- **Database**: PostgreSQL with Prisma ORM for data persistence.
- **Schema Validation**: Zod for validating API request/response payloads and AI model outputs for items and calculation plans.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: NextAuth.js
- **Database ORM**: Prisma
- **Database**: PostgreSQL
- **AI & Calculation Logic**:
    - OpenAI API (GPT models, e.g., gpt-4o-mini) for item extraction and complex calculations (`lib/openai.ts`).
    - Custom `fastFit` heuristic for simple calculations (`lib/fastFit.ts`).
    - Container specifications defined in `lib/containers.ts`.
- **Payment Gateway**: Razorpay
- **Schema Validation**: Zod (`lib/zodSchemas.ts`)
- **File Parsing**: `pdf-parse` (for PDFs)

## Calculation Flow

The load calculation process (`/api/load-calc`) employs a hybrid strategy:
1.  **Input**: User submits a list of items (manually entered or extracted from an uploaded file).
2.  **Validation**: The item list is first validated against a Zod schema.
3.  **Fast-Fit Heuristic**: The system first attempts to find a simple, single-container solution using the `fastFit` algorithm (`lib/fastFit.ts`). This algorithm checks against predefined container capacities (`lib/containers.ts`).
4.  **LLM Fallback**: If the `fastFit` heuristic cannot determine a single-container solution (e.g., items require multiple containers or are too complex for the heuristic), the task is delegated to an advanced LLM (OpenAI GPT via `lib/openai.ts`). The LLM receives the item list and detailed instructions to generate a comprehensive container plan.
5.  **Tagged Result**: The final calculation plan returned to the user (and saved in reports) is tagged with its source (`algorithm` or `llm`), allowing the UI to display results appropriately.

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v18.x or later recommended)
- npm or yarn (project uses npm by default in scripts)
- PostgreSQL server (running locally or accessible via a connection string)
- Git

You will also need API keys/secrets for:
- Razorpay (Test and/or Live keys)
- OpenAI

## Environment Variables

Create a `.env` file in the root of the project (`shipping-load-calculator/.env`) by copying the contents from `.env.example` (also in the project root).

Then, fill in the necessary values in your `.env` file. Refer to `shipping-load-calculator/.env.example` for the required structure:
\`\`\`env
# Database Connection
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000" # Or your deployment URL
NEXTAUTH_SECRET="generate_a_strong_secret_here_e.g_openssl_rand_base64_32"

# Razorpay API Keys
RAZORPAY_KEY_ID="your_razorpay_key_id"
RAZORPAY_KEY_SECRET="your_razorpay_key_secret"
NEXT_PUBLIC_RAZORPAY_KEY_ID="your_razorpay_key_id_for_client_side" # Usually same as RAZORPAY_KEY_ID
RAZORPAY_WEBHOOK_SECRET="your_razorpay_webhook_secret"

# OpenAI API Key
OPENAI_API_KEY="your_openai_api_key"
\`\`\`
**Notes on Environment Variables:**
- `DATABASE_URL`: Replace placeholders with your actual PostgreSQL connection details.
- `NEXTAUTH_SECRET`: Generate a strong random string.
- `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`: From your Razorpay dashboard. Use test keys for development.
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`: This is exposed to the client-side for Razorpay checkout.
- `RAZORPAY_WEBHOOK_SECRET`: The secret you configure in your Razorpay dashboard for webhook signature verification.
- `OPENAI_API_KEY`: Your API key from OpenAI.

## Setup and Installation

1.  **Clone the repository:**
    \`\`\`bash
    git clone <repository_url>
    cd shipping-load-calculator
    \`\`\`

2.  **Install dependencies:**
    \`\`\`bash
    npm install
    \`\`\`

3.  **Configure Environment Variables:**
    - Create the `.env` file as described above.
    - Ensure all required variables are set.

4.  **Database Setup:**
    - Make sure your PostgreSQL server is running.
    - Update `DATABASE_URL` in `.env`.
    - Apply database schema changes:
      \`\`\`bash
      npx prisma generate  # Generate/update Prisma Client
      npx prisma db push   # Sync schema with DB (for dev). Creates DB if not present.
      # For production, use migrations: npx prisma migrate deploy
      # Generate migrations with: npx prisma migrate dev --name your_migration_name
      \`\`\`

## Running the Application

1.  **Start the development server:**
    \`\`\`bash
    npm run dev
    \`\`\`
    The application will be available at `http://localhost:3000` by default.

## Building for Production

1.  **Create a production build:**
    \`\`\`bash
    npm run build
    \`\`\`

2.  **Start the production server:**
    \`\`\`bash
    npm run start
    \`\`\`

## Available Scripts

(Check `package.json` for full list and details)
- `dev`: Runs Next.js in development mode.
- `build`: Builds the application for production.
- `start`: Starts a Next.js production server.
- `lint`: Runs ESLint.
- `prisma:generate`: Shortcut for `npx prisma generate`.
- `prisma:studio`: Opens Prisma Studio to browse your database.
- `prisma:migrate:dev`: Shortcut for `npx prisma migrate dev`.
- `prisma:db:push`: Shortcut for `npx prisma db push`.

## Local Webhook Testing (Razorpay)

To test Razorpay webhooks locally:
1.  Use a tool like `ngrok` or `localtunnel` to expose your local server to the internet.
    Example with ngrok: `ngrok http 3000`
2.  Take the public URL provided by ngrok (e.g., `https://<unique_id>.ngrok.io`) and append your webhook path: `https://<unique_id>.ngrok.io/api/razorpay/webhook`.
3.  Configure this full URL in your Razorpay dashboard's webhook settings, along with the same `RAZORPAY_WEBHOOK_SECRET` you set in your `.env` file.
4.  Ensure your local server is running when testing webhook events.

## License

This project is intended for demonstration and educational purposes. You can adapt and use it under the MIT License (or specify your preferred license).
Consider adding a `LICENSE` file to the project root if a specific open-source license is chosen.
