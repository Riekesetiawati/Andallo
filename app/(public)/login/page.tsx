import { LoginForm } from '@/components/forms';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  return (
    <div className="container py-12">
      <LoginForm next={params.next || ''} />
    </div>
  );
}
