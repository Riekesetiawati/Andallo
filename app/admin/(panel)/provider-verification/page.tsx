import { redirect } from 'next/navigation';

export default function VerificationRedirect() {
  redirect('/admin/providers');
}
