import { useState } from 'react';
import { ArrowRight, PlayCircle, History, Globe, FileText, Video, ZoomIn, CheckCircle2, Mic } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import RubikCube from './RubikCube';

type FileType = 'web' | 'pdf' | 'video';

interface Annotation {
  id: number;
  top: string;
  left: string;
  comment: string;
  author: string;
  type?: 'pin' | 'arrow' | 'rectangle' | 'circle' | 'audio';
  arrowEnd?: { top: string; left: string };
  shapeSize?: { width: string; height: string };
}

interface HistoryItem {
  version: string;
  time: string;
  active: boolean;
}

interface FileContent {
  name: string;
  icon: typeof Globe;
  image?: string;
  renderContent?: () => JSX.Element;
  status: string;
  statusColor: string;
  progress: number;
  annotations: Annotation[];
  history: HistoryItem[];
  clientConfirmed: boolean;
  myConfirmed: boolean;
  amount: number;
}

export default function Hero() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<FileType>('web');
  const [isZoomed, setIsZoomed] = useState(false);

  const handleFileChange = (file: FileType) => {
    setSelectedFile(file);
    setIsZoomed(false);
  };

  const handleGetStarted = () => {
    navigate('/register');
  };

  const handleWatchDemo = () => {
    const demoSection = document.getElementById('demo-preview');
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const fileContents: Record<FileType, FileContent> = {
    web: {
      name: t('files.web'),
      icon: Globe,
      renderContent: () => (
        <div className="absolute inset-0 bg-white/95 overflow-hidden">
          <div className="h-8 bg-gradient-to-r from-gray-800 to-gray-700 flex items-center px-3 gap-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-red-400"></div>
              <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
            </div>
            <div className="ml-2 text-[8px] text-gray-400 font-mono">www.example-shop.com</div>
          </div>
          <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4">
            <div className="text-[10px] font-bold text-gray-800">ShopLogo</div>
            <div className="flex gap-3 text-[8px] text-gray-600">
              <span>Accueil</span>
              <span>Produits</span>
              <span>Contact</span>
            </div>
            <div className="w-12 h-4 bg-blue-500 rounded text-[6px] text-white flex items-center justify-center">Panier</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50">
            <div className="text-center mb-3">
              <div className="text-[12px] font-bold text-gray-800 mb-1">Soldes d'Hiver</div>
              <div className="text-[8px] text-gray-600">Jusqu'à -50% sur une sélection</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white rounded p-2 shadow-sm">
                <div className="w-full h-12 bg-gray-200 rounded mb-1"></div>
                <div className="h-1.5 w-full bg-gray-300 rounded mb-1"></div>
                <div className="h-1.5 w-2/3 bg-gray-300 rounded"></div>
              </div>
              <div className="bg-white rounded p-2 shadow-sm">
                <div className="w-full h-12 bg-gray-200 rounded mb-1"></div>
                <div className="h-1.5 w-full bg-gray-300 rounded mb-1"></div>
                <div className="h-1.5 w-2/3 bg-gray-300 rounded"></div>
              </div>
              <div className="bg-white rounded p-2 shadow-sm">
                <div className="w-full h-12 bg-gray-200 rounded mb-1"></div>
                <div className="h-1.5 w-full bg-gray-300 rounded mb-1"></div>
                <div className="h-1.5 w-2/3 bg-gray-300 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      ),
      status: t('status.approved'),
      statusColor: 'green',
      progress: 75,
      clientConfirmed: true,
      myConfirmed: true,
      amount: 2500,
      annotations: [
        { id: 1, top: '15%', left: '20%', comment: 'Le header semble parfait', author: 'Sophie', type: 'pin' },
        { id: 2, top: '45%', left: '55%', comment: 'Modifier le CTA', author: 'Marc', type: 'arrow', arrowEnd: { top: '50%', left: '70%' } },
        { id: 3, top: '62%', left: '22%', comment: 'Améliorer l\'espacement', author: 'Julie', type: 'rectangle', shapeSize: { width: '22%', height: '15%' } },
        { id: 4, top: '30%', left: '75%', comment: 'Commentaire vocal', author: 'Pierre', type: 'audio' },
      ],
      history: [
        { version: 'v3.2', time: t('time.current'), active: true },
        { version: 'v3.1', time: t('time.hour', { count: 1 }) + ' ' + t('time.ago', { time: '' }).trim(), active: false },
        { version: 'v3.0', time: t('time.yesterday'), active: false },
      ],
    },
    pdf: {
      name: t('files.pdf'),
      icon: FileText,
      image: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=800',
      status: t('status.inReview'),
      statusColor: 'yellow',
      progress: 50,
      clientConfirmed: false,
      myConfirmed: true,
      amount: 1800,
      annotations: [
        { id: 1, top: '25%', left: '40%', comment: 'Vérifier cette section', author: 'Pierre', type: 'circle', shapeSize: { width: '15%', height: '12%' } },
        { id: 2, top: '60%', left: '50%', comment: 'Typo à corriger', author: 'Anne', type: 'arrow', arrowEnd: { top: '65%', left: '65%' } },
        { id: 3, top: '35%', left: '70%', comment: 'Remarque audio', author: 'Luc', type: 'audio' },
      ],
      history: [
        { version: 'v2.5', time: t('time.current'), active: true },
        { version: 'v2.4', time: t('time.hour', { count: 3 }) + ' ' + t('time.ago', { time: '' }).trim(), active: false },
        { version: 'v2.3', time: t('time.days', { count: 2 }) + ' ' + t('time.ago', { time: '' }).trim(), active: false },
      ],
    },
    video: {
      name: t('files.video'),
      icon: Video,
      image: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800',
      status: t('status.pending'),
      statusColor: 'blue',
      progress: 30,
      clientConfirmed: true,
      myConfirmed: false,
      amount: 3200,
      annotations: [
        { id: 1, top: '30%', left: '30%', comment: 'Transition trop rapide', author: 'Thomas', type: 'pin' },
        { id: 2, top: '40%', left: '65%', comment: 'Audio à ajuster', author: 'Claire', type: 'audio' },
        { id: 3, top: '58%', left: '35%', comment: 'Excellent timing', author: 'Luc', type: 'rectangle', shapeSize: { width: '25%', height: '18%' } },
        { id: 4, top: '20%', left: '55%', comment: 'Ajouter sous-titres', author: 'Emma', type: 'arrow', arrowEnd: { top: '28%', left: '68%' } },
      ],
      history: [
        { version: 'v1.3', time: t('time.current'), active: true },
        { version: 'v1.2', time: t('time.hour', { count: 5 }) + ' ' + t('time.ago', { time: '' }).trim(), active: false },
        { version: 'v1.1', time: t('time.days', { count: 3 }) + ' ' + t('time.ago', { time: '' }).trim(), active: false },
      ],
    },
  };

  const currentFile = fileContents[selectedFile];

  return (
    <section className="relative pt-32 pb-24 sm:pb-28 lg:pt-48 lg:pb-32 overflow-hidden bg-white dark:bg-transparent">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-br from-white/20 via-gray-300/20 to-gray-400/20 blur-[120px] rounded-full pointer-events-none opacity-50"></div>

      {/* Cube Rubik pour desktop - en haut à droite */}
      <div className="absolute -top-[19em] -right-[700px] opacity-[0.12] hidden lg:block">
        <RubikCube size={1400} enableHover={true} />
      </div>

      {/* Cube Rubik pour mobile/tablet - derrière le titre */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 opacity-[0.08] lg:hidden pointer-events-none z-0">
        <RubikCube size={600} enableHover={false} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 mb-8">
          <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 tracking-wide uppercase">{t('hero.badge')}</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6 max-w-4xl mx-auto text-gray-900 dark:text-white">
          {t('hero.title')} <br />
          <span className="hero-gradient">{t('hero.titleHighlight')}</span>
        </h1>

        <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          {t('hero.description')}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center mb-12 sm:mb-16">
          <button
            onClick={handleGetStarted}
            className="flex items-center justify-center h-12 px-8 rounded-lg silver-gradient-cta font-bold transition-all"
          >
            {t('hero.ctaPrimary')}
            <ArrowRight className="ml-2" size={18} />
          </button>
          <button
            onClick={handleWatchDemo}
            className="flex items-center justify-center h-12 px-8 rounded-lg glass-panel hover:bg-gray-100 dark:hover:bg-white/10 text-gray-900 dark:text-white font-bold transition-all border border-gray-200 dark:border-white/10"
          >
            <PlayCircle className="mr-2" size={18} />
            {t('hero.ctaSecondary')}
          </button>
        </div>

        <div id="demo-preview" className="relative w-full max-w-5xl mx-auto group perspective-1000">
          <div className="absolute -inset-1 bg-gradient-to-r from-white/40 via-gray-300/40 to-gray-400/40 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative rounded-xl border border-white/10 bg-theme-primary overflow-hidden shadow-2xl">
            <div className="h-10 border-b border-white/5 bg-theme-secondary flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
              <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
              <div className="ml-4 px-3 py-1 bg-black/20 rounded text-[10px] text-gray-500 font-mono flex-1 text-center max-w-[200px] mx-auto">dgtl.fr/dashboard/project-alpha</div>
            </div>

            <div className="aspect-[3/4] sm:aspect-[4/3] md:aspect-[16/10] lg:aspect-[16/9] w-full bg-theme-secondary relative">
              <div className="absolute left-0 top-0 bottom-0 w-16 md:w-64 border-r border-white/5 bg-theme-tertiary hidden sm:flex flex-col p-4 gap-4">
                <div className="h-8 w-24 bg-white/5 rounded"></div>
                <div className="flex flex-col gap-2 mt-4">
                  <button
                    onClick={() => handleFileChange('web')}
                    className={`h-8 w-full rounded flex items-center px-3 gap-2 transition cursor-pointer group ${
                      selectedFile === 'web'
                        ? 'bg-primary/20 border border-primary/30'
                        : 'bg-transparent hover:bg-white/5'
                    }`}
                  >
                    <Globe className={`w-4 h-4 ${selectedFile === 'web' ? 'text-primary/60' : 'text-white/40 group-hover:text-white/60'}`} />
                    <span className={`text-xs font-medium hidden md:block ${selectedFile === 'web' ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>
                      Maquette web
                    </span>
                  </button>
                  <button
                    onClick={() => handleFileChange('pdf')}
                    className={`h-8 w-full rounded flex items-center px-3 gap-2 transition cursor-pointer group ${
                      selectedFile === 'pdf'
                        ? 'bg-primary/20 border border-primary/30'
                        : 'bg-transparent hover:bg-white/5'
                    }`}
                  >
                    <FileText className={`w-4 h-4 ${selectedFile === 'pdf' ? 'text-primary/60' : 'text-white/40 group-hover:text-white/60'}`} />
                    <span className={`text-xs font-medium hidden md:block ${selectedFile === 'pdf' ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>
                      Document.pdf
                    </span>
                  </button>
                  <button
                    onClick={() => handleFileChange('video')}
                    className={`h-8 w-full rounded flex items-center px-3 gap-2 transition cursor-pointer group ${
                      selectedFile === 'video'
                        ? 'bg-primary/20 border border-primary/30'
                        : 'bg-transparent hover:bg-white/5'
                    }`}
                  >
                    <Video className={`w-4 h-4 ${selectedFile === 'video' ? 'text-primary/60' : 'text-white/40 group-hover:text-white/60'}`} />
                    <span className={`text-xs font-medium hidden md:block ${selectedFile === 'video' ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>
                      Présentation.mp4
                    </span>
                  </button>
                </div>
              </div>

              <div className="absolute sm:left-16 md:left-64 inset-0 p-3 sm:p-6 flex flex-col gap-3 sm:gap-6 bg-mesh">
                <div className="flex justify-between items-center">
                  <div className="h-6 sm:h-8 w-32 sm:w-48 bg-white/5 rounded"></div>
                  <div className="flex gap-2">
                    <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-400"></div>
                    <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 -ml-3 sm:-ml-4 border-2 border-[#121118]"></div>
                    <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] sm:text-xs text-white -ml-3 sm:-ml-4 border-2 border-[#121118]">+3</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 h-full">
                  <div
                    className={`sm:col-span-2 sm:row-span-2 bg-white/5 rounded-lg border border-white/10 relative overflow-hidden group/card cursor-crosshair transition-all duration-300 min-h-[280px] sm:min-h-0 ${
                      isZoomed ? 'scale-105' : 'scale-100'
                    }`}
                    onClick={() => setIsZoomed(!isZoomed)}
                  >
                    {currentFile.renderContent ? (
                      currentFile.renderContent()
                    ) : (
                      <div
                        className="absolute inset-0 bg-cover bg-center opacity-60 transition-all duration-500"
                        style={{ backgroundImage: `url('${currentFile.image}')` }}
                      ></div>
                    )}

                    {currentFile.annotations.map((annotation) => {
                      const annotationType = annotation.type || 'pin';

                      if (annotationType === 'arrow' && annotation.arrowEnd) {
                        const startX = parseFloat(annotation.left);
                        const startY = parseFloat(annotation.top);
                        const endX = parseFloat(annotation.arrowEnd.left);
                        const endY = parseFloat(annotation.arrowEnd.top);
                        const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
                        const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));

                        return (
                          <div
                            key={annotation.id}
                            className="absolute opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 group/annotation"
                            style={{
                              top: annotation.top,
                              left: annotation.left,
                              transformOrigin: '0 50%'
                            }}
                          >
                            <div
                              className="relative h-1 bg-amber-500"
                              style={{
                                width: `${length}%`,
                                transform: `rotate(${angle}deg)`
                              }}
                            >
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[8px] border-l-amber-500 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent"></div>
                            </div>
                            <div className="absolute top-6 left-0 bg-theme-tertiary p-3 rounded-lg border border-white/10 shadow-xl w-48 opacity-0 group-hover/annotation:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-4 h-4 rounded-full bg-gray-400"></div>
                                <div className="text-[10px] text-gray-400">{annotation.author}</div>
                              </div>
                              <div className="text-[10px] text-white">{annotation.comment}</div>
                            </div>
                          </div>
                        );
                      }

                      if (annotationType === 'rectangle' && annotation.shapeSize) {
                        return (
                          <div
                            key={annotation.id}
                            className="absolute border-[3px] border-green-500 rounded-sm opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 group/annotation"
                            style={{
                              top: annotation.top,
                              left: annotation.left,
                              width: annotation.shapeSize.width,
                              height: annotation.shapeSize.height
                            }}
                          >
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-theme-tertiary p-3 rounded-lg border border-white/10 shadow-xl w-48 opacity-0 group-hover/annotation:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-4 h-4 rounded-full bg-gray-400"></div>
                                <div className="text-[10px] text-gray-400">{annotation.author}</div>
                              </div>
                              <div className="text-[10px] text-white">{annotation.comment}</div>
                            </div>
                          </div>
                        );
                      }

                      if (annotationType === 'circle' && annotation.shapeSize) {
                        return (
                          <div
                            key={annotation.id}
                            className="absolute border-[3px] border-green-500 rounded-full opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 group/annotation"
                            style={{
                              top: annotation.top,
                              left: annotation.left,
                              width: annotation.shapeSize.width,
                              height: annotation.shapeSize.height
                            }}
                          >
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-theme-tertiary p-3 rounded-lg border border-white/10 shadow-xl w-48 opacity-0 group-hover/annotation:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-4 h-4 rounded-full bg-gray-400"></div>
                                <div className="text-[10px] text-gray-400">{annotation.author}</div>
                              </div>
                              <div className="text-[10px] text-white">{annotation.comment}</div>
                            </div>
                          </div>
                        );
                      }

                      if (annotationType === 'audio') {
                        return (
                          <div
                            key={annotation.id}
                            className="absolute w-8 h-8 bg-red-500 rounded-full shadow-[0_0_0_4px_rgba(239,68,68,0.3)] flex items-center justify-center text-white opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 group/annotation"
                            style={{ top: annotation.top, left: annotation.left }}
                          >
                            <Mic size={14} />
                            <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-theme-tertiary p-3 rounded-lg border border-white/10 shadow-xl w-48 opacity-0 group-hover/annotation:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-4 h-4 rounded-full bg-gray-400"></div>
                                <div className="text-[10px] text-gray-400">{annotation.author}</div>
                              </div>
                              <div className="text-[10px] text-white">{annotation.comment}</div>
                              <div className="mt-2 flex items-center gap-1">
                                <div className="w-1 h-2 bg-red-400 rounded-full animate-pulse"></div>
                                <div className="w-1 h-3 bg-red-400 rounded-full animate-pulse delay-75"></div>
                                <div className="w-1 h-2 bg-red-400 rounded-full animate-pulse delay-150"></div>
                                <div className="text-[9px] text-red-400 ml-1">0:12</div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={annotation.id}
                          className="absolute w-8 h-8 bg-primary rounded-full shadow-[0_0_0_4px_rgba(192,192,192,0.3)] flex items-center justify-center text-gray-900 font-bold text-xs opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 group/annotation"
                          style={{ top: annotation.top, left: annotation.left }}
                        >
                          {annotation.id}
                          <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-theme-tertiary p-3 rounded-lg border border-white/10 shadow-xl w-48 opacity-0 group-hover/annotation:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-4 h-4 rounded-full bg-gray-400"></div>
                              <div className="text-[10px] text-gray-400">{annotation.author}</div>
                            </div>
                            <div className="text-[10px] text-white">{annotation.comment}</div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="absolute top-2 right-2 w-6 h-6 bg-black/40 backdrop-blur-sm rounded flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity">
                      <ZoomIn size={14} className="text-white" />
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-lg border border-white/10 flex flex-col p-3 sm:p-4 gap-2 sm:gap-3 min-h-[200px] sm:min-h-0">
                    <div className="flex justify-between items-center">
                      <div className="text-xs font-bold text-gray-400 uppercase">{t('labels.status')}</div>
                      <div className={`text-xs font-bold ${
                        currentFile.statusColor === 'green' ? 'text-green-400 bg-green-400/10' :
                        currentFile.statusColor === 'yellow' ? 'text-yellow-400 bg-yellow-400/10' :
                        'text-blue-400 bg-blue-400/10'
                      } px-2 py-0.5 rounded transition-all duration-300`}>
                        {currentFile.status}
                      </div>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          currentFile.statusColor === 'green' ? 'bg-green-500' :
                          currentFile.statusColor === 'yellow' ? 'bg-yellow-500' :
                          'bg-blue-500'
                        }`}
                        style={{ width: `${currentFile.progress}%` }}
                      ></div>
                    </div>
                    <div className="space-y-2 pt-2 border-t border-white/5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-400">{t('labels.client')}</span>
                        <span className={`text-[10px] font-medium ${
                          currentFile.clientConfirmed ? 'text-green-400' : 'text-yellow-400'
                        }`}>
                          {currentFile.clientConfirmed ? t('status.confirmed') : t('status.waiting')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-400">{t('labels.me')}</span>
                        <span className={`text-[10px] font-medium ${
                          currentFile.myConfirmed ? 'text-green-400' : 'text-yellow-400'
                        }`}>
                          {currentFile.myConfirmed ? t('status.confirmed') : t('status.waiting')}
                        </span>
                      </div>
                    </div>
                    <div className={`mt-3 pt-3 border-t border-white/5 flex items-center justify-between transition-all duration-300 ${
                      currentFile.clientConfirmed && currentFile.myConfirmed
                        ? 'bg-green-500/10 -mx-4 -mb-4 px-4 pb-4 pt-3'
                        : ''
                    }`}>
                      <div className="flex items-center gap-2">
                        {currentFile.clientConfirmed && currentFile.myConfirmed && (
                          <CheckCircle2 size={14} className="text-green-400" />
                        )}
                        <span className="text-[10px] text-gray-400">{t('labels.amount')}</span>
                      </div>
                      <span className={`text-sm font-bold ${
                        currentFile.clientConfirmed && currentFile.myConfirmed
                          ? 'text-green-400'
                          : 'text-gray-400'
                      }`}>
                        {currentFile.clientConfirmed && currentFile.myConfirmed ? '+' : ''} {currentFile.amount}€
                      </span>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-lg border border-white/10 p-3 sm:p-4 min-h-[180px] sm:min-h-0">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary">
                        <History size={16} />
                      </div>
                      <div className="text-sm font-medium text-white">{t('labels.history')}</div>
                    </div>
                    <div className="space-y-3">
                      {currentFile.history.map((item, index) => (
                        <div key={index} className={`flex items-center gap-2 text-xs ${item.active ? 'text-gray-400' : 'text-gray-600'}`}>
                          <div className={`w-2 h-2 rounded-full ${item.active ? 'bg-primary' : 'bg-gray-700'}`}></div>
                          <span>{item.version} - {item.time}</span>
                        </div>
                      ))}
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
