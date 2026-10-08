'use client';
import ThemeToggle from "@/components/theme-toggle";
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Leaf, ArrowRight, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isAuthApiError } from '@supabase/supabase-js';
export default function AuthForm({reset=false,confirmationError=false}:{reset?:boolean;confirmationError?:boolean}) {
  const router=useRouter();
  const [mode,setMode]=useState<'login'|'signup'|'forgot'|'reset'|'resend'>(reset?'reset':'login');
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState('');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(confirmationError?'That email link has expired or was already used. Try signing in, request a new confirmation email, or use Forgot password.':''),[failed,setFailed]=useState(confirmationError);
  async function submit(event:FormEvent) {
    event.preventDefault();setBusy(true);setMessage('');setFailed(false);
    try {
      const client=createClient();
      const callback=window.location.origin+'/auth/callback';
      if(mode==='login') {
        const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;
        router.replace('/');router.refresh();
      } else if(mode==='signup') {
        const {data,error}=await client.auth.signUp({email,password,options:{data:{full_name:name.trim()},emailRedirectTo:callback}});if(error)throw error;
        if(data.session){router.replace('/');router.refresh();}else setMessage('Check your email to confirm your account, then sign in. Open the link in this browser.');
      } else if(mode==='resend') {
        const {error}=await client.auth.resend({type:'signup',email,options:{emailRedirectTo:callback}});if(error)throw error;
        setMessage('If this account needs confirmation, a new link will arrive in your inbox. Open it in this browser.');
      } else if(mode==='forgot') {
        const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:callback+'?next=/auth/reset'});if(error)throw error;
        setMessage('If an account exists for this address, you will receive a password reset link.');
      } else {
        const {data:{user}}=await client.auth.getUser();if(!user)throw Error('Open the password reset link from your email first.');
        const {error}=await client.auth.updateUser({password});if(error)throw error;
        router.replace('/');router.refresh();
      }
    } catch(error) {
      setFailed(true);
      if(isAuthApiError(error) && error.code==='over_email_send_rate_limit') {
        setMessage('Email sending is temporarily limited. Please wait before trying again. If you already received a confirmation email, use that link. Repeated requests will not clear the limit.');
      } else if(isAuthApiError(error) && error.code==='email_not_confirmed') {
        setMessage('Please confirm your email using the link in your inbox before signing in. Check your spam folder too.');
      } else {
        setMessage(error instanceof Error?error.message:'Unable to connect. Please try again.');
      }
    }
    finally {setBusy(false);}
  }
  const title=mode==='login'?'A little space for you.':mode==='signup'?'Make room for what matters.':mode==='forgot'?'Let’s get you back in.':mode==='resend'?'Confirm your space.':'A fresh start.';
  return <main className="auth-page"><div className="auth-theme"><ThemeToggle/></div><section className="auth-story"><div className="brand"><span className="brand-icon"><Leaf size={24}/></span>avenli<span>.</span></div><div><p className="auth-eyebrow">SMALL STEPS. REAL PROGRESS.</p><h1>Your plans.<br/>Your pace.<br/><span>Your possibility.</span></h1><p>A calmer home for everyday tasks, meaningful goals, and your next big idea.</p></div><small>A little better, every day.</small></section><section className="auth-panel"><div className="auth-card"><span className="brand-icon"><Leaf size={24}/></span><h2>{title}</h2><p>{mode==='login'?'Sign in to your personal workspace.':mode==='signup'?'One workspace for work, life, and everything between.':mode==='forgot'?'Enter your email to request a reset link.':mode==='resend'?'Request a fresh account confirmation link.':'Choose a new password for your account.'}</p><form onSubmit={submit}>{mode==='signup'&&<label>Your name<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" maxLength={80} required/></label>}{mode!=='reset'&&<label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/></label>}{mode!=='forgot'&&mode!=='resend'&&<label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='login'?'current-password':'new-password'} minLength={mode==='login'?1:8} required/>{mode!=='login'&&<small>At least 8 characters.</small>}</label>}{message&&<div className={failed?'auth-message error':'auth-message'} role={failed?'alert':'status'}>{message}</div>}<button className="auth-submit" disabled={busy}>{busy?<Loader2 className="animate-spin" size={17}/>:<>{mode==='login'?'Sign in':mode==='signup'?'Create account':mode==='forgot'?'Send reset link':mode==='resend'?'Resend confirmation':'Save password'}<ArrowRight size={17}/></>}</button></form><div className="auth-links">{mode==='login'?<><button onClick={()=>{setMode('forgot');setMessage('')}}>Forgot password?</button><button onClick={()=>{setMode('resend');setMessage('')}}>Resend confirmation email</button><p>New here? <button onClick={()=>{setMode('signup');setMessage('')}}>Create an account</button></p></>:<button onClick={()=>{setMode('login');setMessage('')}}>Back to sign in</button>}</div></div></section></main>;
}
