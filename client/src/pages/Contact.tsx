import { useMemo, useState } from "react";
import { Mail, Instagram, MapPin, Check, Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { BRAND } from "@/lib/catalog";
import { TurnstileChallenge } from "@/components/TurnstileChallenge";
import { getContactEndpoint } from "@/lib/privateIngress";

type ContactReceipt = {
  received?: boolean;
  receipt?: string;
  duplicate?: boolean;
  error?: string;
};

export default function Contact() {
  const { toast } = useToast();
  const contactEndpoint = useMemo(getContactEndpoint, []);
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || "";
  const [received, setReceived] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const configured = Boolean(contactEndpoint && turnstileSiteKey);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    if (!configured || !contactEndpoint) {
      toast({
        title: "Contact form is not configured",
        description: "Please send us a DM on Instagram while we restore this path.",
        variant: "destructive",
      });
      return;
    }

    if (!consent) {
      toast({
        title: "Consent required",
        description: "Please confirm that we may store your contact message and reply.",
        variant: "destructive",
      });
      return;
    }

    if (!turnstileToken) {
      toast({
        title: "Verification required",
        description: "Complete the security check before sending your message.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(contactEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          consent,
          turnstileToken,
          companyWebsite,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as ContactReceipt;

      if (!response.ok || !result.received) {
        throw new Error(result.error || "Contact submission failed");
      }

      setDuplicate(Boolean(result.duplicate));
      setReceipt(result.receipt || null);
      setReceived(true);
      toast({
        title: result.duplicate ? "Message already received 💜" : "Message received 💜",
        description: result.duplicate
          ? "We already saved this note recently, so no second copy was created."
          : "Your note is saved securely for our team to review.",
      });
    } catch {
      setTurnstileToken("");
      window.turnstile?.reset();
      toast({
        title: "We couldn't save your message",
        description: "Please retry or send us a DM on Instagram.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-3xl px-6 py-14 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.3em] text-gold">
            We'd Love To Hear From You
          </p>
          <h1 className="font-display text-4xl sm:text-5xl">Let's Talk</h1>
          <p className="mx-auto mt-4 max-w-lg text-primary-foreground/80">
            Have a question, need styling advice, or want to collaborate? Send us a
            note here and we'll review it directly.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-12 px-6 py-14 md:grid-cols-2">
        <div className="space-y-6">
          <a
            href={`mailto:${BRAND.email}`}
            className="flex items-center gap-3 text-foreground hover:text-primary"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-secondary/40 text-primary">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm text-muted-foreground">Email</span>
              {BRAND.email}
            </span>
          </a>
          <a
            href="https://instagram.com/jussbeautifulhair"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 text-foreground hover:text-primary"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-secondary/40 text-primary">
              <Instagram className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm text-muted-foreground">
                Fast backup — DM us
              </span>
              {BRAND.instagram}
            </span>
          </a>
          <div className="flex items-center gap-3 text-foreground">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-secondary/40 text-primary">
              <MapPin className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm text-muted-foreground">Location</span>
              Pennsylvania, USA — shipping nationwide
            </span>
          </div>
          <div className="rounded-lg bg-secondary/20 p-4 text-sm text-muted-foreground">
            <strong className="text-foreground">Wholesale &amp; stylists:</strong>{" "}
            use this form and include “wholesale” in your message.
          </div>
        </div>

        <div className="rounded-lg border border-card-border bg-card p-6">
          {received ? (
            <div
              className="py-10 text-center"
              data-testid="text-contact-received"
              role="status"
            >
              <Check className="mx-auto mb-3 h-10 w-10 text-gold" aria-hidden="true" />
              <h2 className="font-display text-2xl text-foreground">
                {duplicate ? "Message already received 💜" : "Message received 💜"}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {duplicate
                  ? "We already saved this note recently, so no second copy was created."
                  : "Your note is saved securely. We'll reply using the email address you provided."}
              </p>
              {receipt ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Receipt: <code data-testid="contact-receipt">{receipt}</code>
                </p>
              ) : null}
              <a
                href="https://instagram.com/jussbeautifulhair"
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
              >
                Need a faster response? DM us on Instagram.
              </a>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" data-testid="contact-form">
              <div>
                <Label htmlFor="cname">Name</Label>
                <Input
                  id="cname"
                  required
                  maxLength={100}
                  autoComplete="name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  data-testid="input-contact-name"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="cemail">Email</Label>
                <Input
                  id="cemail"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, email: event.target.value }))
                  }
                  data-testid="input-contact-email"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="cmsg">Message</Label>
                <Textarea
                  id="cmsg"
                  required
                  minLength={2}
                  maxLength={5000}
                  rows={5}
                  value={form.message}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, message: event.target.value }))
                  }
                  data-testid="input-contact-message"
                  className="mt-1.5"
                />
              </div>

              <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                <Label htmlFor="companyWebsite">Company website</Label>
                <Input
                  id="companyWebsite"
                  name="companyWebsite"
                  value={companyWebsite}
                  onChange={(event) => setCompanyWebsite(event.target.value)}
                  autoComplete="off"
                  tabIndex={-1}
                />
              </div>

              <label className="flex items-start gap-3 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  data-testid="checkbox-contact-consent"
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span>
                  I agree that Juss Beautiful Hair may store this message and my
                  email to review and reply, as explained in the{" "}
                  <a href="/privacy" className="font-medium text-primary underline">
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>

              {turnstileSiteKey ? (
                <TurnstileChallenge
                  siteKey={turnstileSiteKey}
                  action="contact"
                  onToken={setTurnstileToken}
                  testId="contact-turnstile"
                />
              ) : (
                <p className="text-sm text-destructive" role="alert">
                  The contact security check is not configured. Please use Instagram.
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={submitting || !configured}
                className="w-full font-semibold"
                data-testid="button-send-contact"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Saving message…
                  </span>
                ) : (
                  "Send Message"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}
