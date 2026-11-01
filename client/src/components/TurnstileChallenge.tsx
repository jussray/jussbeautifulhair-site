import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_ID = "jbh-turnstile-script";
const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export function TurnstileChallenge({
  siteKey,
  action,
  onToken,
  testId,
}: {
  siteKey: string;
  action: "contact" | "newsletter";
  onToken: (token: string) => void;
  testId?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let script: HTMLScriptElement | null = null;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    setFailed(false);
    setReady(false);
    onToken("");

    const fail = () => {
      if (cancelled) return;
      clearTimeout(timeout);
      if (script && !window.turnstile) script.dataset.loadFailed = "true";
      onToken("");
      setReady(false);
      setFailed(true);
    };

    const render = () => {
      if (
        cancelled ||
        widgetIdRef.current ||
        !containerRef.current
      ) {
        return;
      }
      if (!window.turnstile) {
        fail();
        return;
      }
      clearTimeout(timeout);

      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          callback: (token) => {
            if (cancelled) return;
            onToken(token);
            setReady(Boolean(token));
            setFailed(false);
          },
          "expired-callback": () => {
            if (cancelled) return;
            onToken("");
            setReady(false);
          },
          "error-callback": fail,
        });
      } catch {
        fail();
      }
    };

    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as
      | HTMLScriptElement
      | null;

    if (window.turnstile) {
      render();
    } else {
      // Reuse an in-flight shared load; replace only a known failed attempt.
      if (existing?.dataset.loadFailed === "true") existing.remove();
      script = existing?.dataset.loadFailed !== "true" && existing
        ? existing : document.createElement("script");
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", render, { once: true });
      script.addEventListener("error", fail, { once: true });
      timeout = setTimeout(fail, 15_000);
      if (!script.isConnected) document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      script?.removeEventListener("load", render);
      script?.removeEventListener("error", fail);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, onToken, siteKey, attempt]);

  return (
    <div>
      <div
        ref={containerRef}
        data-testid={testId || `turnstile-${action}`}
        data-verification-state={ready ? "ready" : "pending"}
      />
      {failed && (
        <div role="alert" className="text-sm text-destructive">
          <p>The security check couldn't load. Please try again.</p>
          <button type="button" className="underline" onClick={() => setAttempt((value) => value + 1)}>
            Retry security check
          </button>
        </div>
      )}
    </div>
  );
}
