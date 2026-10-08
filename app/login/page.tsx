import AuthForm from '@/components/auth-form';
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}) { const params=await searchParams;return <AuthForm confirmationError={params.error==='confirmation'} />; }
