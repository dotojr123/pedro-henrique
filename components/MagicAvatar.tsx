
import React from 'react';
import { TutorMood } from '../types';

interface MagicAvatarProps {
  mood: TutorMood;
  isSpeaking: boolean;
}

const MagicAvatar: React.FC<MagicAvatarProps> = ({ mood, isSpeaking }) => {
  const getIcon = () => {
    if (isSpeaking) return '⚡';
    switch (mood) {
      case TutorMood.CELEBRATING: return '🔥';
      case TutorMood.THINKING: return '💾';
      default: return '🤖';
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className={`w-32 h-32 rounded-2xl bg-slate-800 border-2 border-sky-500/50 flex items-center justify-center text-6xl shadow-[0_0_20px_rgba(14,165,233,0.4)] transition-all duration-300 ${isSpeaking ? 'ring-4 ring-sky-400' : ''}`}>
        <span className={isSpeaking ? 'animate-pulse' : ''}>{getIcon()}</span>
      </div>
      
      {/* Status Bar */}
      <div className="mt-4 flex flex-col items-center">
        <div className="text-[10px] uppercase tracking-[0.2em] text-sky-400 font-bold mb-1">Status do Sistema</div>
        <div className="w-32 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full bg-sky-500 transition-all duration-1000 ${isSpeaking ? 'w-full' : 'w-1/3'}`}></div>
        </div>
      </div>
    </div>
  );
};

export default MagicAvatar;
