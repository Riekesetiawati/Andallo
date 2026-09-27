'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { dbErrorMessage } from '@/lib/db';
import { safeNext } from '@/lib/format';
import { requireActor } from '@/lib/guard';
import {
  addComplaintMessage,
  addPortfolio,
  addReview,
  archiveService,
  authenticate,
  cancelBooking,
  changePassword,
  clearCompare,
  confirmPhone,
  createBooking,
  createComplaint,
  createSupport,
  deleteCarousel,
  deleteHighlight,
  deletePortfolio,
  hideReview,
  markNotifications,
  moveCategory,
  registerCustomer,
  registerProvider,
  reorderHighlights,
  requestPasswordReset,
  resetPassword,
  saveBank,
  saveCarousel,
  saveCategory,
  saveHighlight,
  saveHours,
  savePackage,
  saveService,
  saveSetting,
  sendMessage,
  sendPhoneOtp,
  setBankStatus,
  setBookingStatus,
  setComplaintStatus,
  setProviderStatus,
  setTyping,
  toggleCompare,
  toggleFavorite,
  updateProfile,
  updateProviderProfile,
  verifyEmail,
} from '@/lib/repo';
import { issue, loginSchema, passwordSchema, registerSchema } from '@/lib/schemas';
import { clearSession, startSession } from '@/lib/session';
import { z } from 'zod';

function fail(error: unknown): { error: string } {
  return { error: dbErrorMessage(error) };
}

export async function loginAction(_prev: { error?: string } | null, formData: FormData) {
  const parsed = loginSchema.safeParse({ email: String(formData.get('email') || ''), password: String(formData.get('password') || '') });
  if (!parsed.success) return { error: issue(parsed.error) };
  const result = await authenticate(parsed.data.email.toLowerCase(), parsed.data.password, 'web');
  if ('error' in result) return { error: result.error };
  if (formData.get('intent') === 'admin' && result.user.role !== 'admin') return { error: 'Akun ini bukan admin.' };
  await startSession(result.user, formData.get('remember') === 'on');
  const next = safeNext(String(formData.get('next') || ''));
  if (result.user.role === 'admin') redirect(next.startsWith('/admin') ? next : '/admin');
  if (result.user.role === 'provider') redirect(next.startsWith('/mitra') ? next : '/mitra/dashboard');
  redirect(next || '/customer/dashboard');
}

export async function logoutAction() {
  await clearSession();
  redirect('/');
}

export async function registerAction(_prev: { error?: string; verifyPath?: string } | null, formData: FormData) {
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    password: formData.get('password'),
    confirm: formData.get('confirm'),
    terms: formData.get('terms') === 'on',
  });
  if (!parsed.success) return { error: issue(parsed.error) };
  try {
    const created = await registerCustomer(parsed.data);
    const show = process.env.ANDALLO_DEV_LINKS === '1' || process.env.NODE_ENV !== 'production';
    return { verifyPath: show ? created.verifyPath : '', error: '' };
  } catch (error) {
    return fail(error);
  }
}

export async function providerRegisterAction(_prev: { error?: string; verifyPath?: string } | null, formData: FormData) {
  const base = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    password: formData.get('password'),
    confirm: formData.get('confirm'),
    terms: formData.get('terms') === 'on',
  });
  if (!base.success) return { error: issue(base.error) };
  const extra = z.object({
    businessName: z.string().trim().min(2, 'Nama usaha wajib diisi.'),
    description: z.string().trim().min(20, 'Deskripsi minimal 20 karakter.'),
    categoryId: z.string().uuid('Pilih kategori.'),
    address: z.string().trim().min(5, 'Alamat wajib diisi.'),
    city: z.string().trim().min(3, 'Kota wajib diisi.'),
    lat: z.coerce.number(),
    lng: z.coerce.number(),
    radius: z.coerce.number().min(1).max(100),
  }).safeParse({
    businessName: formData.get('businessName'),
    description: formData.get('description'),
    categoryId: formData.get('categoryId'),
    address: formData.get('address'),
    city: formData.get('city'),
    lat: formData.get('lat'),
    lng: formData.get('lng'),
    radius: formData.get('radius'),
  });
  if (!extra.success) return { error: issue(extra.error) };
  try {
    const created = await registerProvider({ ...base.data, ...extra.data, imageUrl: String(formData.get('imageUrl') || ''), documentUrl: String(formData.get('documentUrl') || '') });
    const show = process.env.ANDALLO_DEV_LINKS === '1' || process.env.NODE_ENV !== 'production';
    return { verifyPath: show ? created.verifyPath : '', error: '' };
  } catch (error) {
    return fail(error);
  }
}

export async function forgotAction(_prev: { error?: string; path?: string; sent?: boolean } | null, formData: FormData) {
  const email = z.string().email('Email tidak valid.').safeParse(formData.get('email'));
  if (!email.success) return { error: issue(email.error) };
  const result = await requestPasswordReset(email.data.toLowerCase());
  const show = process.env.ANDALLO_DEV_LINKS === '1' || process.env.NODE_ENV !== 'production';
  return { sent: true, path: show ? result.path : '' };
}

export async function resetAction(_prev: { error?: string; ok?: boolean } | null, formData: FormData) {
  const parsed = z.object({ token: z.string().min(10), password: passwordSchema, confirm: z.string() }).refine((value) => value.password === value.confirm, { message: 'Konfirmasi kata sandi tidak sama.' }).safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) return { error: issue(parsed.error) };
  const ok = await resetPassword(parsed.data.token, parsed.data.password);
  if (!ok) return { error: 'Tautan tidak berlaku atau sudah kedaluwarsa.' };
  return { ok: true };
}

export async function verifyEmailAction(token: string) {
  return verifyEmail(token);
}

export async function bookAction(_prev: { error?: string } | null, formData: FormData) {
  const actor = await requireActor('customer');
  try {
    const booking = await createBooking(actor, {
      serviceId: String(formData.get('serviceId')),
      packageId: String(formData.get('packageId')),
      date: String(formData.get('date')),
      time: String(formData.get('time')),
      address: String(formData.get('address') || ''),
      notes: String(formData.get('notes') || ''),
      method: String(formData.get('method') || 'HOME_SERVICE'),
    });
    redirect(`/customer/bookings/${booking.id}?baru=1`);
  } catch (error) {
    if (typeof error === 'object' && error && 'digest' in error) throw error;
    return fail(error);
  }
}

export async function statusAction(formData: FormData) {
  const actor = await requireActor();
  try {
    await setBookingStatus(actor, String(formData.get('id')), String(formData.get('status')));
  } catch (error) {
    redirect(`${formData.get('back') || '/'}?notice=${encodeURIComponent(dbErrorMessage(error))}`);
  }
  revalidatePath('/', 'layout');
}

export async function cancelAction(formData: FormData) {
  const actor = await requireActor();
  const back = String(formData.get('back') || '/customer/bookings');
  try {
    await cancelBooking(actor, String(formData.get('id')), String(formData.get('reason') || 'Lainnya'), String(formData.get('note') || ''));
  } catch (error) {
    redirect(`${back}?notice=${encodeURIComponent(dbErrorMessage(error))}`);
  }
  redirect(back);
}

export async function reviewAction(formData: FormData) {
  const actor = await requireActor('customer');
  try {
    await addReview(actor, { bookingId: String(formData.get('bookingId')), rating: Number(formData.get('rating')), comment: String(formData.get('comment') || '') });
  } catch (error) {
    redirect(`/customer/bookings/${formData.get('bookingId')}?notice=${encodeURIComponent(dbErrorMessage(error))}`);
  }
  redirect(`/provider/${formData.get('slug') || ''}`);
}

export async function favoriteAction(formData: FormData) {
  const actor = await requireActor('customer');
  await toggleFavorite(actor, String(formData.get('providerId')));
  revalidatePath('/', 'layout');
}

export async function compareAction(formData: FormData) {
  const actor = await requireActor('customer');
  const header = await headers();
  let back = '/jasa';
  try {
    const url = new URL(header.get('referer') || '');
    if (url.pathname.startsWith('/')) back = `${url.pathname}${url.search}`;
  } catch {
    back = '/jasa';
  }
  try {
    await toggleCompare(actor, String(formData.get('serviceId')));
  } catch (error) {
    redirect(`/bandingkan?notice=${encodeURIComponent(dbErrorMessage(error))}`);
  }
  redirect(back);
}

export async function clearCompareAction() {
  const actor = await requireActor('customer');
  await clearCompare(actor);
  redirect('/bandingkan');
}

export async function complaintAction(_prev: { error?: string } | null, formData: FormData) {
  const actor = await requireActor();
  try {
    const id = await createComplaint(actor, {
      bookingId: String(formData.get('bookingId')),
      category: String(formData.get('category') || ''),
      title: String(formData.get('title') || ''),
      description: String(formData.get('description') || ''),
      expected: String(formData.get('expected') || ''),
      fileUrl: String(formData.get('fileUrl') || '') || undefined,
    });
    redirect(`${actor.role === 'provider' ? '/mitra' : '/customer'}/complaints/${id}`);
  } catch (error) {
    if (typeof error === 'object' && error && 'digest' in error) throw error;
    return fail(error);
  }
}

export async function complaintMessageAction(formData: FormData) {
  const actor = await requireActor();
  await addComplaintMessage(actor, String(formData.get('id')), String(formData.get('body') || ''));
  revalidatePath('/', 'layout');
}

export async function profileAction(_prev: { error?: string; ok?: boolean } | null, formData: FormData) {
  const actor = await requireActor();
  try {
    await updateProfile(actor, { name: String(formData.get('name') || ''), phone: String(formData.get('phone') || '') });
    revalidatePath('/customer/profile');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function passwordAction(_prev: { error?: string; ok?: boolean } | null, formData: FormData) {
  const actor = await requireActor();
  const parsed = passwordSchema.safeParse(formData.get('password'));
  if (!parsed.success) return { error: issue(parsed.error) };
  const ok = await changePassword(actor, String(formData.get('current') || ''), parsed.data);
  if (!ok) return { error: 'Kata sandi saat ini salah.' };
  return { ok: true };
}

export async function phoneOtpAction() {
  const actor = await requireActor();
  const code = await sendPhoneOtp(actor);
  return { code };
}

export async function confirmPhoneAction(_prev: { error?: string; ok?: boolean } | null, formData: FormData) {
  const actor = await requireActor();
  const ok = await confirmPhone(actor, String(formData.get('code') || ''));
  if (!ok) return { error: 'Kode OTP tidak berlaku.' };
  return { ok: true };
}

export async function supportAction(_prev: { error?: string; ok?: boolean } | null, formData: FormData) {
  const parsed = z.object({
    name: z.string().trim().min(3),
    email: z.string().email('Email tidak valid.'),
    message: z.string().trim().min(10, 'Pesan minimal 10 karakter.'),
  }).safeParse({ name: formData.get('name'), email: formData.get('email'), message: formData.get('message') });
  if (!parsed.success) return { error: issue(parsed.error) };
  await createSupport(parsed.data);
  return { ok: true };
}

export async function serviceAction(_prev: { error?: string } | null, formData: FormData) {
  const actor = await requireActor('provider');
  try {
    const id = await saveService(actor, {
      id: String(formData.get('id') || '') || undefined,
      name: String(formData.get('name') || ''),
      categoryId: String(formData.get('categoryId') || ''),
      description: String(formData.get('description') || ''),
      duration: Number(formData.get('duration') || 60),
      method: String(formData.get('method') || 'BOTH'),
      active: formData.get('active') === 'on',
    });
    redirect(`/mitra/services?saved=${id}`);
  } catch (error) {
    if (typeof error === 'object' && error && 'digest' in error) throw error;
    return fail(error);
  }
}

export async function archiveServiceAction(formData: FormData) {
  const actor = await requireActor('provider');
  await archiveService(actor, String(formData.get('id')));
  revalidatePath('/mitra/services');
}

export async function packageAction(_prev: { error?: string; ok?: boolean } | null, formData: FormData) {
  const actor = await requireActor('provider');
  try {
    await savePackage(actor, {
      id: String(formData.get('id') || '') || undefined,
      serviceId: String(formData.get('serviceId')),
      name: String(formData.get('name') || ''),
      description: String(formData.get('description') || ''),
      price: Number(formData.get('price') || 0),
      duration: Number(formData.get('duration') || 60),
      active: formData.get('active') === 'on',
    });
    revalidatePath('/mitra/prices');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function portfolioAction(_prev: { error?: string; ok?: boolean } | null, formData: FormData) {
  const actor = await requireActor('provider');
  const imageUrl = String(formData.get('imageUrl') || '');
  if (!imageUrl) return { error: 'Unggah foto terlebih dahulu.' };
  try {
    await addPortfolio(actor, { serviceId: String(formData.get('serviceId') || '') || undefined, imageUrl, caption: String(formData.get('caption') || '') });
    revalidatePath('/mitra/portfolio');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deletePortfolioAction(formData: FormData) {
  const actor = await requireActor('provider');
  await deletePortfolio(actor, String(formData.get('id')));
  revalidatePath('/mitra/portfolio');
}

export async function providerProfileAction(_prev: { error?: string; ok?: boolean } | null, formData: FormData) {
  const actor = await requireActor('provider');
  try {
    await updateProviderProfile(actor, {
      businessName: String(formData.get('businessName') || ''),
      description: String(formData.get('description') || ''),
      phone: String(formData.get('phone') || ''),
      businessEmail: String(formData.get('businessEmail') || ''),
      address: String(formData.get('address') || ''),
      city: String(formData.get('city') || ''),
      lat: Number(formData.get('lat') || 0),
      lng: Number(formData.get('lng') || 0),
      radius: Number(formData.get('radius') || 10),
      method: String(formData.get('method') || 'BOTH'),
      coverUrl: String(formData.get('coverUrl') || ''),
    });
    revalidatePath('/mitra/profile');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function hoursAction(formData: FormData) {
  const actor = await requireActor('provider');
  const rows = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    start: String(formData.get(`start-${weekday}`) || '08:00'),
    end: String(formData.get(`end-${weekday}`) || '17:00'),
    active: formData.get(`active-${weekday}`) === 'on',
  }));
  await saveHours(actor, rows);
  revalidatePath('/mitra/schedule');
}

export async function bankAction(_prev: { error?: string; ok?: boolean } | null, formData: FormData) {
  const actor = await requireActor('provider');
  try {
    await saveBank(actor, {
      bankName: String(formData.get('bankName') || ''),
      accountNumber: String(formData.get('accountNumber') || ''),
      accountHolder: String(formData.get('accountHolder') || ''),
      evidenceUrl: String(formData.get('evidenceUrl') || ''),
    });
    revalidatePath('/mitra/bank');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function providerStatusAction(formData: FormData) {
  const actor = await requireActor('admin');
  await setProviderStatus(actor, String(formData.get('id')), String(formData.get('status')), String(formData.get('note') || ''));
  revalidatePath('/admin/providers');
}

export async function bankStatusAction(formData: FormData) {
  const actor = await requireActor('admin');
  await setBankStatus(actor, String(formData.get('id')), String(formData.get('status')));
  revalidatePath('/admin/banks');
}

export async function reviewHideAction(formData: FormData) {
  const actor = await requireActor('admin');
  await hideReview(actor, String(formData.get('id')), formData.get('hide') === '1');
  revalidatePath('/admin/reviews');
}

export async function complaintStatusAction(formData: FormData) {
  const actor = await requireActor('admin');
  await setComplaintStatus(actor, String(formData.get('id')), String(formData.get('status')));
  revalidatePath('/admin/complaints');
}

export async function highlightAction(_prev: { error?: string; ok?: boolean } | null, formData: FormData) {
  const actor = await requireActor('admin');
  try {
    await saveHighlight(actor, {
      id: String(formData.get('id') || '') || undefined,
      providerId: String(formData.get('providerId')),
      headline: String(formData.get('headline') || ''),
      subtitle: String(formData.get('subtitle') || ''),
      banner: String(formData.get('banner') || ''),
      cta: String(formData.get('cta') || 'Lihat mitra'),
      active: formData.get('active') === 'on',
    });
    revalidatePath('/admin/highlights');
    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function highlightOrderAction(formData: FormData) {
  const actor = await requireActor('admin');
  await reorderHighlights(actor, String(formData.get('ids') || '').split(',').filter(Boolean));
  revalidatePath('/admin/highlights');
}

export async function deleteHighlightAction(formData: FormData) {
  const actor = await requireActor('admin');
  await deleteHighlight(actor, String(formData.get('id')));
  revalidatePath('/admin/highlights');
}

export async function carouselAction(_prev: { error?: string; ok?: boolean } | null, formData: FormData) {
  const actor = await requireActor('admin');
  try {
    await saveCarousel(actor, {
      id: String(formData.get('id') || '') || undefined,
      title: String(formData.get('title') || ''),
      subtitle: String(formData.get('subtitle') || ''),
      image: String(formData.get('image') || ''),
      link: String(formData.get('link') || '/jasa'),
      active: formData.get('active') === 'on',
    });
    revalidatePath('/admin/carousel');
    revalidatePath('/');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteCarouselAction(formData: FormData) {
  const actor = await requireActor('admin');
  await deleteCarousel(actor, String(formData.get('id')));
  revalidatePath('/admin/carousel');
}

export async function categoryAction(_prev: { error?: string; ok?: boolean } | null, formData: FormData) {
  const actor = await requireActor('admin');
  try {
    await saveCategory(actor, { id: String(formData.get('id') || '') || undefined, name: String(formData.get('name') || ''), icon: String(formData.get('icon') || 'sparkles'), active: formData.get('active') === 'on' });
    revalidatePath('/admin/categories');
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function categoryToggleAction(formData: FormData) {
  const actor = await requireActor('admin');
  await saveCategory(actor, { id: String(formData.get('id') || '') || undefined, name: String(formData.get('name') || ''), icon: String(formData.get('icon') || 'sparkles'), active: formData.get('active') === 'on' });
  revalidatePath('/admin/categories');
}

export async function categoryMoveAction(formData: FormData) {
  const actor = await requireActor('admin');
  await moveCategory(actor, String(formData.get('id')), Number(formData.get('direction')) < 0 ? -1 : 1);
  revalidatePath('/admin/categories');
}

export async function settingsAction(formData: FormData) {
  const actor = await requireActor('admin');
  await saveSetting(actor, formData.get('requirePhone') === 'on');
  revalidatePath('/admin/settings');
}

export async function readNotificationsAction() {
  const actor = await requireActor();
  await markNotifications(actor);
  revalidatePath('/', 'layout');
}

export async function chatAction(threadId: string, body: string) {
  const actor = await requireActor();
  if (!body.trim()) return { error: 'Pesan kosong.' };
  try {
    await sendMessage(actor, threadId, body);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function typingAction(threadId: string) {
  const actor = await requireActor();
  await setTyping(actor, threadId);
}
