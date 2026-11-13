'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, MessageSquare, X } from 'lucide-react';

const backendURL = 'https://paradox-software.youtrack.cloud';
const formUUID = '7a44d78c-7bb9-413b-ac72-4183c5255294';
const formURL = `${backendURL}/form/${formUUID}`;
type UnmountFeedback = () => void;

declare global {
  interface Window {
    YTFeedbackForm?: {
      renderInline: (container: HTMLElement, options: {
        backendURL: string;
        formUUID: string;
        theme: 'dark';
        language: 'en';
      }) => Promise<UnmountFeedback>;
    };
  }
}

export default function ApplicationFeedback() {
  const container = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]',
      ) ?? [])].filter(element => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      launcher.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const host = container.current;
    if (!host) return;
    let disposed = false;
    let unmount: UnmountFeedback | undefined;
    const controller = new AbortController();
    const script = document.createElement('script');
    const fail = () => { if (!disposed) setStatus('error'); };
    const render = async () => {
      if (disposed) return;
      try {
        if (!window.YTFeedbackForm) throw new Error('Feedback form unavailable');
        const cleanup = await window.YTFeedbackForm.renderInline(host, {
          backendURL,
          formUUID,
          theme: 'dark',
          language: 'en',
        });
        if (disposed) cleanup();
        else {
          unmount = cleanup;
          setStatus('ready');
        }
      } catch {
        fail();
      }
    };

    const load = async () => {
      try {
        // Check CORS before mounting the widget so blocked origins get a usable direct link.
        const response = await fetch(`${backendURL}/api/feedbackForms/${formUUID}?fields=form(id,disabled,errors)`, {
          mode: 'cors',
          credentials: 'omit',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Feedback form unavailable');
        const config = await response.json() as {
          form?: { disabled?: boolean; errors?: unknown[] };
        };
        if (!config.form || config.form.disabled || config.form.errors?.length) {
          throw new Error('Feedback form unavailable');
        }
        if (disposed) return;
        if (window.YTFeedbackForm) await render();
        else {
          script.src = `${backendURL}/static/simplified/form/form-entry.js?auto=false`;
          script.async = true;
          script.onload = () => { void render(); };
          script.onerror = fail;
          document.head.appendChild(script);
        }
      } catch {
        fail();
      }
    };
    void load();

    return () => {
      disposed = true;
      controller.abort();
      script.onload = null;
      script.onerror = null;
      script.remove();
      unmount?.();
    };
  }, [open, attempt]);

  return <div className="application-feedback">
    <h3>Application feedback</h3>
    <p>Report a bug, request a feature, or share your experience with our applications.</p>
    <button ref={launcher} type="button" className="button dark" aria-haspopup="dialog" onClick={() => {
      setStatus('loading');
      setOpen(true);
    }}><MessageSquare size={17}/> Send application feedback</button>
    {open && createPortal(<div className="feedback-overlay" onClick={event => {
      if (event.target === event.currentTarget) setOpen(false);
    }}><section ref={dialog} className="feedback-dialog" role="dialog" aria-modal="true" aria-label="Application feedback">
      <div className="feedback-dialog-bar">
        <span className="eyebrow">APPLICATION FEEDBACK</span>
        <button type="button" className="feedback-close" aria-label="Close feedback form" autoFocus onClick={() => setOpen(false)}><X size={18}/></button>
      </div>
      <div className="feedback-form" ref={container}/>
      <div className="feedback-status" role="status">
        {status === 'loading' && <p>Loading feedback form…</p>}
        {status === 'error' && <>
          <p>The embedded form is unavailable. You can still send feedback directly in YouTrack.</p>
          <button type="button" className="button light" onClick={() => {
            setStatus('loading');
            setAttempt(value => value + 1);
          }}>Retry feedback form</button>
        </>}
      </div>
      <a className="feedback-direct-link" href={formURL} target="_blank" rel="noopener noreferrer">
        Open feedback form in a new tab <ArrowUpRight size={14}/>
      </a>
    </section></div>, document.body)}
  </div>;
}
