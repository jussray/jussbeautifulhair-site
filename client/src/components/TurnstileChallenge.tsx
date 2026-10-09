import { useEffect, useRef } from "react";

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

  useEffect(() => {
    let cancelled = false;
    let script: HTMLScriptElement | null = null;
    let onScriptError: (() => void) | null = null;

    const render = () => {
      if (
        cancelled ||
        widgetIdRef.current ||
        !containerRef.current ||
        !window.turnstile
      ) {
        return;
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };

    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as
      | HTMLScriptElement
      | null;

    if (window.turnstile) {
      render();
    } else {
      // A failed or incomplete shared script must not strand subsequent mounts.
      if (existing && !window.turnstile) existing.remove();
      script = document.createElement("script");
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", render, { once: true });
      onScriptError = () => {
        onToken("");
        script?.remove();
      };
      script.addEventListener("error", onScriptError, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      script?.removeEventListener("load", render);
      if (onScriptError) script?.removeEventListener("error", onScriptError);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, onToken, siteKey]);

  return (
    <div
      ref={containerRef}
      data-testid={testId || `turnstile-${action}`}
    />
  );
}
