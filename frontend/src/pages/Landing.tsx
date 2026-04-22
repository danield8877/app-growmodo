import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ArrowRight, Globe } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useTheme } from '../contexts/ThemeContext';

function normalizeUrlInput(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export default function Landing() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const [urlInput, setUrlInput] = useState('');

  useLayoutEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = mainRef.current;
    if (!root) return;

    const clearHeroStyles = () => {
      gsap.set(
        root.querySelectorAll(
          '.landing-hero-accent, .landing-hero-badge, .landing-hero-line, .landing-hero-desc, .landing-hero-cta, .landing-hero-note, .landing-url-block'
        ),
        { clearProps: 'all' }
      );
    };

    if (reduced) {
      clearHeroStyles();
      return;
    }

    const ctx = gsap.context(() => {
      const easeOut = 'power4.out';
      const tl = gsap.timeline({ defaults: { ease: easeOut } });

      tl.fromTo(
        '.landing-hero-accent',
        { scaleX: 0, opacity: 0 },
        {
          scaleX: 1,
          opacity: 1,
          duration: 0.85,
          ease: 'power2.inOut',
          transformOrigin: 'left center',
        }
      )
        .fromTo(
          '.landing-hero-badge',
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.5 },
          0.08
        )
        .fromTo(
          '.landing-hero-line',
          { opacity: 0, y: 36 },
          { opacity: 1, y: 0, duration: 0.62, stagger: 0.09 },
          0.12
        )
        .fromTo(
          '.landing-hero-desc',
          { opacity: 0, y: 22 },
          { opacity: 1, y: 0, duration: 0.55 },
          '-=0.38'
        )
        .fromTo(
          '.landing-hero-cta',
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.48, stagger: 0.08 },
          '-=0.32'
        )
        .fromTo(
          '.landing-hero-note',
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.4 },
          '-=0.28'
        )
        .fromTo(
          '.landing-url-block',
          { opacity: 0, y: 28 },
          { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' },
          '-=0.2'
        );
    }, mainRef);

    return () => {
      ctx.revert();
      clearHeroStyles();
    };
  }, [i18n.language, theme]);

  const handleOpenRevamp = () => {
    const normalized = normalizeUrlInput(urlInput);
    if (!normalized) return;
    navigate(`/revamper/new?url=${encodeURIComponent(normalized)}`);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-neutral-100 font-display text-neutral-900 selection:bg-neutral-900/10 selection:text-neutral-900 dark:bg-[#0c0b10] dark:text-[#e8e6ed] dark:selection:bg-white/15 dark:selection:text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.22] dark:opacity-[0.35]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed -top-40 -right-40 h-[480px] w-[480px] rounded-full blur-3xl bg-[radial-gradient(circle,rgba(0,0,0,0.05)_0%,transparent_70%)] dark:bg-[radial-gradient(circle,rgba(255,255,255,0.07)_0%,transparent_70%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed -bottom-32 -left-24 h-[420px] w-[420px] rounded-full blur-3xl bg-[radial-gradient(circle,rgba(100,100,110,0.08)_0%,transparent_70%)] dark:bg-[radial-gradient(circle,rgba(200,200,210,0.06)_0%,transparent_70%)]"
        aria-hidden
      />

      <Navbar />

      <main ref={mainRef} className="relative z-10">
        <section
          id="hero"
          className="relative px-4 pb-16 pt-28 sm:px-6 sm:pt-32 md:px-8 lg:px-12 lg:pb-20"
        >
          <div className="mx-auto max-w-5xl">
            <div
              className="landing-hero-accent mb-8 h-[2px] w-24 max-w-[min(40%,12rem)] rounded-full bg-gradient-to-r from-neutral-800/80 via-neutral-500/50 to-transparent dark:from-white/70 dark:via-neutral-400/60"
              aria-hidden
            />
            <p className="landing-hero-badge mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-200/90 bg-white/60 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-neutral-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-300">
              {t('internalLanding.badge')}
            </p>
            <h1 className="text-4xl font-bold leading-[1.12] tracking-tight text-neutral-900 sm:text-5xl md:text-6xl lg:text-7xl dark:text-white">
              <span className="landing-hero-line landing-hero-silver-text block">
                {t('internalLanding.heroTitle')}
              </span>
              <span className="landing-hero-line mt-2 block bg-gradient-to-r from-neutral-700 via-neutral-500 to-neutral-400 bg-clip-text font-semibold text-transparent dark:from-neutral-100 dark:via-neutral-300 dark:to-neutral-500">
                {t('internalLanding.heroHighlight')}
              </span>
            </h1>
            <p className="landing-hero-desc mt-8 max-w-2xl text-lg font-normal leading-relaxed text-neutral-600 md:text-xl dark:text-neutral-400">
              {t('internalLanding.heroDescription')}
            </p>
            <div className="landing-hero-cta mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
              <a
                href="#revamp-url"
                className="group inline-flex min-h-[48px] items-center justify-center gap-2 text-sm font-semibold text-neutral-600 transition hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
              >
                {t('internalLanding.heroScrollToUrl')}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
              </a>
              <Link
                to="/imager/new"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-neutral-200/90 bg-white/80 px-6 py-3 text-sm font-semibold text-neutral-900 shadow-sm backdrop-blur-sm transition hover:border-neutral-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-400/30 focus:ring-offset-2 focus:ring-offset-neutral-100 dark:border-white/15 dark:bg-white/[0.04] dark:text-white dark:shadow-none dark:hover:border-white/25 dark:hover:bg-white/[0.07] dark:focus:ring-white/20 dark:focus:ring-offset-[#0c0b10]"
              >
                {t('internalLanding.heroImagerLink')}
              </Link>
            </div>
            <p className="landing-hero-note mt-8 max-w-xl text-sm font-normal leading-relaxed text-neutral-500 dark:text-neutral-500">
              {t('internalLanding.heroNote')}
            </p>
          </div>
        </section>

        <section
          id="revamp-url"
          className="scroll-mt-24 border-t border-neutral-200/80 px-4 py-16 dark:border-white/5 sm:px-6 md:px-8 lg:px-12"
        >
          <div className="landing-url-block mx-auto max-w-3xl rounded-2xl border border-neutral-200/90 bg-white/80 p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none sm:p-8 md:p-10">
            <div className="mb-6 flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-neutral-200/90 bg-neutral-50 text-neutral-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-200">
                <Globe className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 md:text-2xl dark:text-white">{t('internalLanding.urlBlockTitle')}</h2>
                <p className="mt-2 text-sm font-normal leading-relaxed text-neutral-600 md:text-base dark:text-neutral-400">
                  {t('internalLanding.urlBlockDescription')}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <input
                type="text"
                name="revamp-url-input"
                autoComplete="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleOpenRevamp();
                }}
                placeholder={t('internalLanding.urlPlaceholder')}
                className="min-h-[52px] flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-[15px] text-neutral-900 placeholder:text-neutral-400 shadow-sm focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400/20 dark:border-white/10 dark:bg-[#0a090d] dark:text-white dark:placeholder:text-neutral-500 dark:shadow-none dark:focus:border-white/20 dark:focus:ring-white/10"
              />
              <button
                type="button"
                onClick={handleOpenRevamp}
                disabled={!urlInput.trim()}
                className="inline-flex min-h-[52px] shrink-0 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-[#0c0b10] shadow-lg shadow-black/20 transition disabled:cursor-not-allowed disabled:opacity-40 dark:shadow-black/30 silver-gradient-cta"
              >
                {t('internalLanding.urlSubmit')}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-500">{t('internalLanding.urlHint')}</p>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
