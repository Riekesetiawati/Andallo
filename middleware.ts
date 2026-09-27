import { NextResponse, type NextRequest } from 'next/server';
import { readSession } from '@/lib/token';

export async function middleware(request: NextRequest) {
  const session = await readSession(request.cookies.get('andallo_session')?.value);
  const path = request.nextUrl.pathname;
  if (path.startsWith('/admin') && path !== '/admin/login') {
    if (session?.role !== 'admin') return NextResponse.redirect(new URL('/admin/login', request.url));
  }
  if (path.startsWith('/customer') && session?.role !== 'customer') {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }
  if (path.startsWith('/mitra') && !path.startsWith('/mitra/register') && session?.role !== 'provider') {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin', '/admin/:path*', '/customer/:path*', '/mitra', '/mitra/:path*'] };
