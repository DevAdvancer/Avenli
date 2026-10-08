'use client';
import {useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {Button} from '@/components/ui/button';
import {useRouter} from 'next/navigation';
export default function SignOut(){const router=useRouter();const [busy,setBusy]=useState(false),[error,setError]=useState('');return <><Button variant="outline" disabled={busy} onClick={async()=>{setBusy(true);const {error}=await createClient().auth.signOut();if(error){setError(error.message);setBusy(false);}else {router.replace('/login');router.refresh();}}}>Sign out</Button>{error&&<p role="alert">{error}</p>}</>}
