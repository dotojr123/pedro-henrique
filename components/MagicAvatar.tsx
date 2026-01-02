
import React from 'react';
import { TutorMood } from '../types';

interface MagicAvatarProps {
  mood: TutorMood;
  isSpeaking: boolean;
}

const MagicAvatar: React.FC<MagicAvatarProps> = ({ mood, isSpeaking }) => {
  const getExpression = () => {
    if (isSpeaking) return '😮';
    switch (mood) {
      case TutorMood.CELEBRATING: return '🤩';
      case TutorMood.THINKING: return '🤔';
      case TutorMood.HAPPY: return '😊';
      default: return '🙂';
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className={`w-40 h-40 rounded-full bg-gradient-to-br from-yellow-300 to-orange-400 flex items-center justify-center text-8xl shadow-2xl transition-all duration-500 border-8 border-white ${isSpeaking ? 'scale-110 animate-pulse' : 'scale-100'}`}>
        {getExpression()}
      </div>
      
      {/* Decorative sparkles for celebrations */}
      {mood === TutorMood.CELEBRATING && (
        <div className="absolute top-0 w-full h-full pointer-events-none">
          <div className="absolute top-0 left-0 animate-ping text-2xl">✨</div>
          <div className="absolute bottom-0 right-0 animate-ping text-2xl delay-300">⭐</div>
          <div className="absolute top-1/2 -right-4 animate-bounce text-2xl delay-150">🎨</div>
        </div>
      )}
      
      <div className="mt-4 px-6 py-2 bg-white rounded-full shadow-md">
        <span className="font-bold text-orange-600 text-xl tracking-wide">Professor Mágico</span>
      </div>
    </div>
  );
};

export default MagicAvatar;
