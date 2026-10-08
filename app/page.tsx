import Workspace from "@/components/avenli-workspace";
import { getVerifiedUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export const dynamic="force-dynamic";
export default async function Home() { const user=await getVerifiedUser(); if(!user?.email_confirmed_at)redirect('/login'); return <Workspace />; }
