import { useEffect, useRef } from "react";
import { Link, useSearch } from "wouter";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
export default function SuccessPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const sessionId = params.get("session_id");
  const { clearCart } = useCart();
  const clearedRef = useRef(false);
  useEffect(() => { if (!clearedRef.current) { clearedRef.current = true; clearCart(); } }, [clearCart]);
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full rounded-2xl border bg-card p-8 text-center space-y-5 shadow-sm">
        <div className="flex justify-center"><CheckCircle2 className="w-14 h-14 text-green-500" strokeWidth={1.5} /></div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Order confirmed!</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">Thank you for shopping with Juss Beautiful Hair. A confirmation email is on its way and we'll keep you updated as your order ships.</p>
        </div>
        {sessionId && <p className="text-xs text-muted-foreground">Order ref: <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{sessionId.slice(-12)}</code></p>}
        <Link href="/shop"><Button className="w-full" size="lg">Keep shopping</Button></Link>
      </div>
    </div>
  );
}
