"use client";
import { ArrowDownToLine, Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import SignOut from "@/components/sign-out";
import { useState } from "react";

export default function AccountMenu({name,email,onSettings,onExport,busy}:{name:string;email:string;onSettings:()=>void;onExport:()=>void;busy:boolean}){
 const [open,setOpen]=useState(false);
 return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><button className="avatar tiny" aria-label="Account menu">{(name||email||"A").slice(0,1).toUpperCase()}</button></PopoverTrigger><PopoverContent align="end" sideOffset={12} className="account-menu" aria-label="Your account"><div className="account-menu-heading"><strong>{name||"Your account"}</strong><span>{email}</span></div><button onClick={()=>{setOpen(false);onSettings()}}><Settings2 size={16}/>Settings & preferences</button><button disabled={busy} onClick={()=>{setOpen(false);onExport()}}><ArrowDownToLine size={16}/>Export my data</button><div className="account-menu-signout"><SignOut/></div></PopoverContent></Popover>;
}
