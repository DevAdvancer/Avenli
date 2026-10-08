import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(request: NextRequest) {
  const code=request.nextUrl.searchParams.get('code');
  const destination=request.nextUrl.searchParams.get('next')==='/auth/reset'?'/auth/reset':'/';
  if(code) {
    const client=await createClient();
    const {error}=await client.auth.exchangeCodeForSession(code);
    if(!error)return NextResponse.redirect(new URL(destination, request.url));
  }
  return NextResponse.redirect(new URL('/login?error=confirmation', request.url));
}
