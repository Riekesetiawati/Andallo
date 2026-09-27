import { LoginForm } from '@/components/forms';

export default function AdminLogin() {
  return (
    <div className="container py-16">
      <LoginForm intent="admin" next="/admin" />
    </div>
  );
}
