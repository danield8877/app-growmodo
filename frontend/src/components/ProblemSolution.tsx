import { X, Check, Image, MessageSquare, Download, Clock, CheckCircle2, Pencil, ZoomIn, ZoomOut, MapPin } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function ProblemSolution() {
  const { t } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const emailRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [centerEmailIndex, setCenterEmailIndex] = useState(0);
  const [currentAutoIndex, setCurrentAutoIndex] = useState(0);
  const [workflowStep, setWorkflowStep] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [zoom, setZoom] = useState(1);
  const [activeAnnotation, setActiveAnnotation] = useState<number | null>(null);
  const [visibleAnnotations, setVisibleAnnotations] = useState<number[]>([]);

  const chaosEmails = [
    {
      subject: t('problemSolution.emails.subject1'),
      message: t('problemSolution.emails.message1'),
      time: t('problemSolution.emails.timeYesterday')
    },
    {
      subject: t('problemSolution.emails.subject2'),
      message: t('problemSolution.emails.message2'),
      time: t('problemSolution.emails.timeHoursAgo', { count: 2 })
    },
    {
      subject: t('problemSolution.emails.subject3'),
      message: t('problemSolution.emails.message3'),
      time: t('problemSolution.emails.timeHoursAgo', { count: 5 })
    },
    {
      subject: t('problemSolution.emails.subject4'),
      message: t('problemSolution.emails.message4'),
      time: t('problemSolution.emails.timeToday')
    },
    {
      subject: t('problemSolution.emails.subject5'),
      message: t('problemSolution.emails.message5'),
      time: t('problemSolution.emails.timeMinutesAgo', { count: 30 })
    },
    {
      subject: t('problemSolution.emails.subject6'),
      message: t('problemSolution.emails.message6'),
      time: t('problemSolution.emails.timeHoursAgo', { count: 1 })
    },
    {
      subject: t('problemSolution.emails.subject7'),
      message: t('problemSolution.emails.message7'),
      time: t('problemSolution.emails.timeHoursAgo', { count: 3 })
    },
    {
      subject: t('problemSolution.emails.subject8'),
      message: t('problemSolution.emails.message8'),
      time: t('problemSolution.emails.timeYesterday')
    }
  ];

  const workflowSteps = [
    {
      status: 'pending',
      statusColor: 'text-yellow-400',
      statusBg: 'bg-yellow-500/10',
      statusDot: 'bg-yellow-400',
      statusText: t('problemSolution.with.status.pendingReview'),
      statusIcon: Clock,
      comment: null,
      showTyping: false
    },
    {
      status: 'commenting',
      statusColor: 'text-blue-400',
      statusBg: 'bg-blue-500/10',
      statusDot: 'bg-blue-400',
      statusText: t('problemSolution.with.status.inReview'),
      statusIcon: Pencil,
      comment: t('problemSolution.with.messages.colorUpdated'),
      showTyping: true
    },
    {
      status: 'approved',
      statusColor: 'text-green-400',
      statusBg: 'bg-green-500/10',
      statusDot: 'bg-green-400',
      statusText: t('problemSolution.with.status.approved'),
      statusIcon: CheckCircle2,
      comment: t('problemSolution.with.messages.colorUpdated'),
      showTyping: false
    }
  ];

  const annotations = [
    {
      id: 1,
      x: 25,
      y: 30,
      comment: t('problemSolution.with.annotations.logoBigger'),
      author: t('problemSolution.with.annotations.client'),
      time: t('problemSolution.with.annotations.timeAgo.minutes', { count: 2 }),
      color: "bg-blue-500"
    },
    {
      id: 2,
      x: 65,
      y: 45,
      comment: t('problemSolution.with.annotations.changeColor'),
      author: t('problemSolution.with.annotations.designer'),
      time: t('problemSolution.with.annotations.timeAgo.minutes', { count: 1 }),
      color: "bg-purple-500"
    },
    {
      id: 3,
      x: 45,
      y: 70,
      comment: t('problemSolution.with.annotations.buttonPerfect'),
      author: t('problemSolution.with.annotations.developer'),
      time: t('problemSolution.with.annotations.timeAgo.seconds', { count: 30 }),
      color: "bg-green-500"
    }
  ];

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.top + containerRect.height / 2;

      let closestIndex = 0;
      let closestDistance = Infinity;

      emailRefs.current.forEach((ref, index) => {
        if (!ref) return;
        const rect = ref.getBoundingClientRect();
        const itemCenter = rect.top + rect.height / 2;
        const distance = Math.abs(itemCenter - containerCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setCenterEmailIndex(closestIndex);
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollToEmail = (index: number) => {
      const emailRef = emailRefs.current[index];
      if (!emailRef || !container) return;

      const containerRect = container.getBoundingClientRect();
      const emailRect = emailRef.getBoundingClientRect();
      const scrollTop = container.scrollTop;
      const targetScroll = scrollTop + (emailRect.top - containerRect.top) - (containerRect.height / 2) + (emailRect.height / 2);

      container.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    };

    scrollToEmail(0);

    const interval = setInterval(() => {
      setCurrentAutoIndex((prev) => {
        const nextIndex = (prev + 1) % chaosEmails.length;
        scrollToEmail(nextIndex);
        return nextIndex;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const currentStep = workflowSteps[workflowStep];

    if (currentStep.showTyping && currentStep.comment) {
      let charIndex = 0;
      setTypedText('');

      const typingInterval = setInterval(() => {
        if (charIndex < currentStep.comment.length) {
          setTypedText(currentStep.comment.substring(0, charIndex + 1));
          charIndex++;
        } else {
          clearInterval(typingInterval);
        }
      }, 50);

      return () => clearInterval(typingInterval);
    } else {
      setTypedText(currentStep.comment || '');
    }
  }, [workflowStep]);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setWorkflowStep((prev) => (prev + 1) % workflowSteps.length);
    }, 4000);

    return () => clearInterval(stepInterval);
  }, []);

  useEffect(() => {
    annotations.forEach((annotation, index) => {
      setTimeout(() => {
        setVisibleAnnotations((prev) => [...prev, annotation.id]);
      }, index * 1500);
    });

    const cycleInterval = setInterval(() => {
      setActiveAnnotation((prev) => {
        if (prev === null) return annotations[0].id;
        const currentIndex = annotations.findIndex(a => a.id === prev);
        return annotations[(currentIndex + 1) % annotations.length].id;
      });
    }, 3000);

    return () => clearInterval(cycleInterval);
  }, []);

  return (
    <section className="py-24 bg-white dark:bg-[#121118] relative" id="workflow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">
            {t('problemSolution.title')} <br />
            {t('problemSolution.titleLine2')} <span className="text-primary">{t('problemSolution.titleHighlight')}</span>
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-lg">{t('problemSolution.subtitle')}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="group relative rounded-2xl border border-red-500/20 bg-gray-50 dark:bg-surface-dark p-1 overflow-hidden transition-all hover:border-red-500/40">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent animate-[scan_3s_ease-in-out_infinite]"></div>
              <div className="absolute top-1/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent animate-[scan_4s_ease-in-out_infinite_1s]"></div>
              <div className="absolute top-2/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent animate-[scan_5s_ease-in-out_infinite_2s]"></div>
            </div>

            <div className="absolute -right-20 -top-20 w-40 h-40 bg-red-500/5 rounded-full blur-3xl group-hover:bg-red-500/10 transition-all duration-1000"></div>
            <div className="absolute -left-20 -bottom-20 w-40 h-40 bg-red-500/5 rounded-full blur-3xl group-hover:bg-red-500/10 transition-all duration-1000"></div>

            <div className="bg-white dark:bg-[#16151b] rounded-xl p-8 relative z-10 flex flex-col h-[660px]">
              <div className="inline-flex items-center gap-2 text-red-500 dark:text-red-400 mb-6 bg-red-500/10 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">
                <X size={14} className="animate-[spin_3s_linear_infinite]" /> {t('problemSolution.before.badge')}
              </div>

              <div className="relative flex-1 overflow-hidden px-2">
                <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white dark:from-[#16151b] dark:via-transparent dark:to-[#16151b] z-20 pointer-events-none"></div>

                <div
                  ref={scrollContainerRef}
                  className="h-full overflow-y-auto scroll-smooth scrollbar-hide snap-y snap-mandatory"
                  style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    scrollBehavior: 'smooth',
                    WebkitOverflowScrolling: 'touch'
                  }}
                >
                  <div className="flex flex-col gap-6 py-[140px]">
                    {chaosEmails.map((email, index) => {
                      const isCenterEmail = index === centerEmailIndex;
                      const distance = Math.abs(index - centerEmailIndex);
                      const opacity = distance === 0 ? 1 : distance === 1 ? 0.4 : 0.2;
                      const blur = distance === 0 ? 0 : distance === 1 ? 1 : 2;
                      const scale = distance === 0 ? 1 : 0.95;

                      return (
                        <div
                          key={index}
                          ref={(el) => (emailRefs.current[index] = el)}
                          className="snap-center transition-all duration-700 ease-out"
                          style={{
                            opacity,
                            filter: `blur(${blur}px)`,
                            transform: `scale(${scale})`
                          }}
                        >
                          <div className={`relative bg-gray-100 dark:bg-white/5 p-5 rounded-lg border border-gray-200 dark:border-white/5 ml-4 border-l-2 ${
                            isCenterEmail
                              ? 'border-l-red-500/50 shadow-[0_0_30px_-5px_rgba(239,68,68,0.3)]'
                              : 'border-l-red-500/30'
                          }`}>
                            {isCenterEmail && (
                              <div className="absolute -left-2 top-0 bottom-0 w-px bg-gradient-to-b from-red-500/0 via-red-500/70 to-red-500/0 animate-pulse"></div>
                            )}

                            <div className="flex items-center justify-between mb-3">
                              <div className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="relative">
                                  {email.subject}
                                  {isCenterEmail && (
                                    <span className="absolute inset-0 bg-red-500/20 blur-md animate-pulse"></span>
                                  )}
                                </span>
                              </div>
                              <div className={`text-xs text-gray-500 dark:text-gray-500 ${isCenterEmail ? 'animate-pulse' : ''}`}>
                                {email.time}
                              </div>
                            </div>

                            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">{email.message}</p>

                            {isCenterEmail && (
                              <>
                                <div className="flex gap-2 items-center">
                                  <div className="h-7 px-3 bg-red-500/20 rounded border border-red-500/40 animate-[pulse_1.5s_ease-in-out_infinite] flex items-center">
                                    <span className="text-xs text-red-300 font-medium">{t('problemSolution.before.waitingForReply')}</span>
                                  </div>
                                  <div className="flex gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-[ping_1s_ease-in-out_infinite]"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-[ping_1s_ease-in-out_infinite_0.3s]"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-[ping_1s_ease-in-out_infinite_0.6s]"></div>
                                  </div>
                                </div>

                                <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg animate-bounce">
                                  {t('problemSolution.before.urgent')}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="absolute top-4 right-4 bg-red-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-red-500/30 z-30">
                  <div className="text-xs text-red-300 font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    {t('problemSolution.before.emailsPending', { count: chaosEmails.length })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="group relative rounded-2xl border border-primary/30 bg-gray-50 dark:bg-surface-dark p-1 overflow-hidden transition-all hover:border-primary shadow-[0_0_50px_-20px_rgba(51,13,242,0.15)]">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-100"></div>

            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-[scan_3s_ease-in-out_infinite]"></div>
              <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent animate-[scan_4s_ease-in-out_infinite_1s]"></div>
            </div>

            <div className="absolute -right-20 -top-20 w-40 h-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-1000"></div>
            <div className="absolute -left-20 -bottom-20 w-40 h-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-1000"></div>

            <div className="bg-white dark:bg-[#16151b] rounded-xl p-8 relative z-10 flex flex-col h-[660px]">
              <div className="inline-flex items-center gap-2 text-primary mb-6 bg-primary/10 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex-shrink-0">
                <Check size={14} /> {t('problemSolution.with.badge')}
              </div>

              <div className="mb-6 relative bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 flex-shrink-0">
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
                  <button
                    onClick={() => setZoom(Math.max(1, zoom - 0.25))}
                    disabled={zoom <= 1}
                    className="w-6 h-6 rounded bg-gray-800/10 dark:bg-white/10 hover:bg-gray-800/20 dark:hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-gray-900 dark:text-white transition-all"
                  >
                    <ZoomOut size={12} />
                  </button>
                  <div className="px-2 py-0.5 bg-gray-800/10 dark:bg-white/10 rounded text-[10px] text-gray-900 dark:text-white font-medium">
                    {Math.round(zoom * 100)}%
                  </div>
                  <button
                    onClick={() => setZoom(Math.min(2, zoom + 0.25))}
                    disabled={zoom >= 2}
                    className="w-6 h-6 rounded bg-gray-800/10 dark:bg-white/10 hover:bg-gray-800/20 dark:hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-gray-900 dark:text-white transition-all"
                  >
                    <ZoomIn size={12} />
                  </button>
                </div>

                <div
                  className="relative w-full h-[200px] transition-transform duration-300 ease-out"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center center'
                  }}
                >
                  <div className="absolute inset-0">
                    <img
                      src="/woman-reading-a-fashion-magazine-2025-02-11-01-35-56-utc.jpg"
                      alt="Design preview"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10"></div>

                  {annotations.slice(0, 2).map((annotation) => (
                    <div
                      key={annotation.id}
                      className={`absolute transition-all duration-500 ${
                        visibleAnnotations.includes(annotation.id)
                          ? 'opacity-100 scale-100'
                          : 'opacity-0 scale-0'
                      }`}
                      style={{
                        left: `${annotation.x}%`,
                        top: `${annotation.y}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      <div
                        className={`relative cursor-pointer transition-all duration-300 ${
                          activeAnnotation === annotation.id ? 'scale-110' : 'scale-100'
                        }`}
                        onMouseEnter={() => setActiveAnnotation(annotation.id)}
                      >
                        <div className={`w-6 h-6 ${annotation.color} rounded-full flex items-center justify-center shadow-lg transition-all ${
                          activeAnnotation === annotation.id
                            ? 'ring-2 ring-white/30 animate-pulse'
                            : 'ring-1 ring-white/20'
                        }`}>
                          <MapPin size={12} className="text-white" />
                        </div>

                        {activeAnnotation === annotation.id && (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-48 animate-[fadeIn_0.3s_ease-out] z-50">
                            <div className="bg-surface-dark-lighter border border-white/10 rounded-lg p-2 shadow-2xl">
                              <div className="flex items-start gap-2">
                                <div className={`w-5 h-5 ${annotation.color} rounded-full flex items-center justify-center flex-shrink-0`}>
                                  <span className="text-white text-[10px] font-bold">
                                    {annotation.author[0]}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[10px] font-bold text-white">{annotation.author}</span>
                                    <span className="text-[9px] text-gray-500">{annotation.time}</span>
                                  </div>
                                  <p className="text-[10px] text-gray-300 leading-snug">{annotation.comment}</p>
                                </div>
                              </div>
                            </div>
                            <div className={`w-2 h-2 ${annotation.color} absolute -top-1 left-1/2 -translate-x-1/2 rotate-45`}></div>
                          </div>
                        )}
                      </div>

                      {activeAnnotation === annotation.id && (
                        <div className={`absolute inset-0 ${annotation.color} rounded-full opacity-30 animate-ping`}></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 relative flex flex-col flex-1 min-h-0">
                <div className="bg-gray-100 dark:bg-surface-dark-lighter p-5 rounded-lg border border-gray-200 dark:border-white/10 shadow-lg transition-all duration-500 flex-1 flex flex-col overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center text-primary transition-all">
                        <Image size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white">{t('problemSolution.with.fileName')}</div>
                        <div className={`text-xs ${workflowSteps[workflowStep].statusColor} flex items-center gap-1 transition-all duration-500`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${workflowSteps[workflowStep].statusDot} ${workflowStep === 0 ? 'animate-pulse' : ''}`}></span>
                          {workflowSteps[workflowStep].statusText}
                        </div>
                      </div>
                    </div>
                    <button
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-gray-900 dark:text-white transition-all duration-500 ${
                        workflowStep === 2
                          ? 'bg-green-500/20 hover:bg-green-500/30 animate-pulse'
                          : 'bg-white/5 cursor-not-allowed opacity-50'
                      }`}
                      disabled={workflowStep !== 2}
                    >
                      <Check size={14} />
                    </button>
                  </div>

                  {workflowStep > 0 && (
                    <div className="space-y-2">
                      <div
                        className="flex items-start gap-2 bg-gray-200 dark:bg-black/20 p-3 rounded border border-gray-300 dark:border-white/5 transition-all duration-500"
                        style={{
                          opacity: workflowStep >= 1 ? 1 : 0,
                          transform: workflowStep >= 1 ? 'translateY(0)' : 'translateY(-10px)'
                        }}
                      >
                        <MessageSquare className="text-primary flex-shrink-0 mt-0.5" size={14} />
                        <div className="flex-1">
                          <span className="text-xs text-gray-700 dark:text-gray-300">
                            {workflowStep === 1 ? typedText : workflowSteps[1].comment}
                            {workflowStep === 1 && typedText.length < workflowSteps[1].comment!.length && (
                              <span className="inline-block w-1 h-3 bg-primary ml-0.5 animate-pulse"></span>
                            )}
                          </span>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 whitespace-nowrap">10:42 AM</span>
                          {workflowStep >= 2 && (
                            <div className="flex gap-0.5 animate-[fadeIn_0.5s_ease-out]">
                              <Check size={10} className="text-primary" />
                              <Check size={10} className="text-primary -ml-1" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        className="flex items-start gap-2 bg-gray-200 dark:bg-black/20 p-3 rounded border border-gray-300 dark:border-white/5 transition-all duration-500"
                        style={{
                          opacity: workflowStep >= 2 ? 1 : 0,
                          transform: workflowStep >= 2 ? 'translateY(0)' : 'translateY(-10px)'
                        }}
                      >
                        <MessageSquare className="text-green-400 flex-shrink-0 mt-0.5" size={14} />
                        <div className="flex-1">
                          <span className="text-xs text-gray-700 dark:text-gray-300">
                            {t('problemSolution.with.messages.perfect')}
                          </span>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 whitespace-nowrap">10:43 AM</span>
                          {workflowStep >= 2 && (
                            <div className="flex gap-0.5 animate-[fadeIn_0.5s_ease-out_0.3s]">
                              <Check size={10} className="text-primary" />
                              <Check size={10} className="text-primary -ml-1" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        className="flex items-start gap-2 bg-gray-200 dark:bg-black/20 p-3 rounded border border-gray-300 dark:border-white/5 transition-all duration-500"
                        style={{
                          opacity: workflowStep >= 2 ? 1 : 0,
                          transform: workflowStep >= 2 ? 'translateY(0)' : 'translateY(-10px)',
                          transitionDelay: '0.2s'
                        }}
                      >
                        <MessageSquare className="text-blue-400 flex-shrink-0 mt-0.5" size={14} />
                        <div className="flex-1">
                          <span className="text-xs text-gray-700 dark:text-gray-300">
                            {t('problemSolution.with.messages.approvedForProduction')}
                          </span>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 whitespace-nowrap">10:44 AM</span>
                          {workflowStep >= 2 && (
                            <div className="flex gap-0.5 animate-[fadeIn_0.5s_ease-out_0.6s]">
                              <Check size={10} className="text-primary" />
                              <Check size={10} className="text-primary -ml-1" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {workflowStep === 0 && (
                    <div className="flex items-center gap-2 mt-3 animate-pulse">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-[ping_1s_ease-in-out_infinite]"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-[ping_1s_ease-in-out_infinite_0.3s]"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-[ping_1s_ease-in-out_infinite_0.6s]"></div>
                      </div>
                      <span className="text-xs text-yellow-400/70 font-medium">{t('problemSolution.with.waitingForReview')}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center px-2 flex-shrink-0">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full border-2 border-[#16151b] transition-all hover:scale-110 relative overflow-hidden">
                      <img
                        src="https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop"
                        alt="User"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">M</span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full border-2 border-[#16151b] transition-all hover:scale-110 relative overflow-hidden">
                      <img
                        src="https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop"
                        alt="User"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">S</span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full border-2 border-[#16151b] bg-primary flex items-center justify-center text-xs text-white transition-all hover:scale-110 shadow-lg shadow-primary/50 relative overflow-hidden">
                      <img
                        src="https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=100&h=100&fit=crop"
                        alt="User"
                        className="w-full h-full object-cover absolute inset-0"
                      />
                      <div className="absolute inset-0 bg-primary/60 flex items-center justify-center">
                        <span className="text-white text-xs font-bold relative z-10">You</span>
                      </div>
                    </div>
                  </div>
                  <button className="text-xs font-bold px-4 py-2 rounded-lg silver-gradient-cta transition-all">
                    {t('problemSolution.with.shareProject')}
                  </button>
                </div>

                <div className="absolute -top-2 -right-2 z-10">
                  <div className={`transition-all duration-500 ${
                    workflowStep === 2
                      ? 'scale-100 opacity-100'
                      : 'scale-0 opacity-0'
                  }`}>
                    <div className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg animate-bounce flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      {t('problemSolution.with.validated')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
