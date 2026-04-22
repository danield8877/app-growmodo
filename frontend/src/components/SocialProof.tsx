import { Diamond, Zap, Cloud, Building2, Infinity } from 'lucide-react';

export default function SocialProof() {
  return (
    <div className="mt-20 border-y border-white/5 bg-white/[0.02]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-center text-sm text-gray-500 mb-6 font-medium">TRUSTED BY INNOVATIVE TEAMS WORLDWIDE</p>
        <div className="flex flex-wrap justify-center items-center gap-12 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
          <div className="text-xl font-bold font-display text-white flex items-center gap-2">
            <Diamond size={24} />
            ACME Corp
          </div>
          <div className="text-xl font-bold font-display text-white flex items-center gap-2">
            <Zap size={24} />
            EnergyX
          </div>
          <div className="text-xl font-bold font-display text-white flex items-center gap-2">
            <Cloud size={24} />
            Nebula
          </div>
          <div className="text-xl font-bold font-display text-white flex items-center gap-2">
            <Building2 size={24} />
            Structura
          </div>
          <div className="text-xl font-bold font-display text-white flex items-center gap-2">
            <Infinity size={24} />
            Loop
          </div>
        </div>
      </div>
    </div>
  );
}
