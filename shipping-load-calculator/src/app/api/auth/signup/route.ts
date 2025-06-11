// src/app/api/auth/signup/route.ts
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { name, companyName, mobile, email, password } = await req.json();

    if (!email || !password || !mobile) {
      return NextResponse.json({ message: 'Email, password, and mobile are required' }, { status: 400 });
    }

    const existingUserByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingUserByEmail) {
      return NextResponse.json({ message: 'User with this email already exists' }, { status: 409 });
    }

    const existingUserByMobile = await prisma.user.findUnique({ where: { mobile } });
    if (existingUserByMobile) {
      return NextResponse.json({ message: 'User with this mobile number already exists' }, { status: 409 });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        companyName,
        mobile,
        email,
        passwordHash,
      },
    });

    // Exclude passwordHash from the returned user object
    const { passwordHash: _, ...userWithoutPassword } = user;
    return NextResponse.json({ user: userWithoutPassword }, { status: 201 });

  } catch (error) {
    console.error('Signup Error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
