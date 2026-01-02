
import React from 'react';
import { GameState } from '../types';

interface GameDisplayProps {
  gameState: GameState;
}

const GameDisplay: React.FC<GameDisplayProps> = ({ gameState }) => {
  if (gameState.gameType === 'IDLE') {
    return (
      <div className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl border-4 border-dashed border-sky-300 text-center max-w-md w-full">
        <h2 className="text-2xl font-bold text-sky-800 mb-2">Olá, Pedro Henrique! 👋</h2>
        <p className="text-sky-600">Diga "Olá" para começarmos a brincar de ler!</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-3xl shadow-xl border-4 border-orange-200 text-center max-w-lg w-full transform transition-all hover:scale-[1.02]">
      <div className="mb-4 text-sm font-bold text-orange-400 uppercase tracking-widest">
        {gameState.gameType.replace('_', ' ')}
      </div>
      
      <div className="text-6xl font-black text-sky-900 mb-6 tracking-tight title-font">
        {gameState.currentWord || '...'}
      </div>

      {gameState.options && gameState.options.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mt-6">
          {gameState.options.map((opt, i) => (
            <div key={i} className="p-4 bg-sky-50 rounded-xl border-2 border-sky-200 text-2xl font-bold text-sky-700">
              {opt}
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-xl text-gray-700 italic">
        {gameState.message}
      </p>
    </div>
  );
};

export default GameDisplay;
