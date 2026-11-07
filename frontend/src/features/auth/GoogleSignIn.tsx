import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api/client';

interface GoogleIdentity {
  initialize(options: { client_id: string; callback: (response: { credential: string }) => void; auto_select: boolean }): void;
  renderButton(element: HTMLElement, options: { theme: string; size: string; text: string }): void;
}
declare global { interface Window { google?: { accounts: { id: GoogleIdentity } } } }
let loading: Promise<void> | undefined;
function loadGoogle() {
  if (window.google?.accounts.id) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    const timer = setTimeout(() => { script.remove(); reject(new Error('Google sign-in timed out.')); }, 15000);
    script.onload = () => {
      clearTimeout(timer);
      if (window.google?.accounts.id) resolve();
      else { script.remove(); reject(new Error('Google sign-in could not load.')); }
    };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Google sign-in could not load.')); };
    document.head.appendChild(script);
  }).catch(error => { loading = undefined; throw error; });
  return loading;
}

export function GoogleSignIn({ registering, busy, onCredential }: {
  registering: boolean; busy: boolean; onCredential: (credential: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  callback.current = onCredential;
  const [message, setMessage] = useState('Loading Google sign-in…');
  const [attempt, setAttempt] = useState(0);
  const [retry, setRetry] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    setMessage('Loading Google sign-in…'); setRetry(false);
    void (async () => {
      const config = await api<{ clientId: string }>('/auth/google/config', { signal: controller.signal })
        .finally(() => clearTimeout(timeout));
      if (!active) return;
      if (!config.clientId) { setMessage('Google sign-in is awaiting setup. You can use email and password.'); return; }
      await loadGoogle();
      if (!active || !host.current) return;
      const identity = window.google?.accounts.id;
      if (!identity) throw new Error('Google sign-in could not load.');
      identity.initialize({ client_id: config.clientId, auto_select: false,
        callback: response => { if (active) callback.current(response.credential); } });
      identity.renderButton(host.current, { theme: 'outline', size: 'large', text: registering ? 'signup_with' : 'signin_with' });
      setMessage('');
    })().catch(() => { if (active) { setMessage('Google sign-in is unavailable. Try again or use email and password.'); setRetry(true); } });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [registering, attempt]);
  return <div aria-label="Google sign-in" inert={busy}>
    <div ref={host} />
    {message && <><button type="button" disabled>Continue with Google</button><p role="status">{message}</p></>}
    {retry && <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry Google sign-in</button>}
  </div>;
}
