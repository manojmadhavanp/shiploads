// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (user && user.passwordHash && bcrypt.compareSync(credentials.password, user.passwordHash)) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            // subscriptionPlan: user.subscriptionPlan, // Add this if not using DB fetch in session callback
          };
        } else {
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
     async jwt({ token, user }) {
       if (user) { // user object is available on sign-in/sign-up
         token.id = user.id;
         // If you added subscriptionPlan to the user object in authorize, pass it to token:
         // if ((user as any).subscriptionPlan) {
         //   token.subscriptionPlan = (user as any).subscriptionPlan;
         // }
       }
       return token;
     },
     async session({ session, token }) {
       if (session.user) {
         (session.user as any).id = token.id;
         try {
           const userFromDb = await prisma.user.findUnique({
             where: { id: token.id as string },
             select: { subscriptionPlan: true }
           });
           if (userFromDb) {
             (session.user as any).subscriptionPlan = userFromDb.subscriptionPlan;
           } else {
             (session.user as any).subscriptionPlan = 'free'; // Default
           }
         } catch (dbError) {
           console.error("Error fetching user for session subscriptionPlan update:", dbError);
           (session.user as any).subscriptionPlan = 'free'; // Default on error
         }
       }
       return session;
     },
  }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
