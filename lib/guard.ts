import { redirect } from 'next/navigation';
import { getActor } from './session';
import type { Actor } from './db';

export async function requireActor(role?: Actor['role']) {
  const actor = await getActor();
  if (!actor) redirect(role === 'admin' ? '/admin/login' : '/login');
  if (role && actor.role !== role) {
    redirect(actor.role === 'admin' ? '/admin' : actor.role === 'provider' ? '/mitra/dashboard' : '/customer/dashboard');
  }
  return actor;
}
