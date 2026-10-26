import { redirect } from 'next/navigation';
import { AuthForm } from '@/features/auth/AuthForm';
import { getAuthContext } from '@/lib/auth';
import { isDemoMode } from '@/lib/app-config';

export default async function LoginPage() {
  if (isDemoMode()) redirect('/');
  if (await getAuthContext()) redirect('/');
  return <AuthForm mode="login" />;
}
