
import React from 'react';
import { GameState } from '../types';

interface GameDisplayProps {
  gameState: GameState;
}

const GameDisplay: React.FC<GameDisplayProps> = ({ gameState }) => {
  if (gameState.gameType === 'IDLE') {
    return (
      <div className="bg-slate-800/50 backdrop-blur-md p-8 rounded-2xl border border-slate-700 text-center max-w-md w-full">
        <h2 className="text-xl font-bold text-sky-400 mb-4 code-font">MÓDULO DE TREINO: OFFLINE</h2>
        <p className="text-slate-400 text-sm">Pedro, conecte o microfone para iniciar a missão de hoje.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl max-w-lg w-full">
      <div className="flex justify-between items-center mb-6">
        <span className="text-[10px] font-bold text-sky-500 uppercase tracking-widest bg-sky-500/10 px-2 py-1 rounded">
          Missão: {gameState.gameType.replace('_', ' ')}
        </span>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <div className="w-2 h-2 rounded-full bg-slate-600"></div>
        </div>
      </div>
      
      {gameState.gameType === 'WORD_SEARCH' && gameState.grid ? (
        <div className="grid grid-cols-5 gap-2 mb-6 bg-slate-900 p-4 rounded-xl">
          {gameState.grid.flat().map((char, i) => (
            <div key={i} className="aspect-square flex items-center justify-center bg-slate-800 border border-slate-700 rounded text-xl font-bold text-sky-300 hover:bg-sky-500/20 cursor-default transition-colors">
              {char}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-4xl font-bold text-white mb-6 text-center leading-tight">
          {gameState.currentWord}
        </div>
      )}

      {gameState.options && gameState.options.length > 0 && (
        <div className="grid grid-cols-1 gap-3 mt-4">
          {gameState.options.map((opt, i) => (
            <div key={i} className="p-3 bg-slate-900 border border-slate-700 rounded-lg text-sm font-medium text-slate-300 flex items-center gap-3">
              <span className="w-5 h-5 flex items-center justify-center bg-sky-500/20 text-sky-500 rounded text-[10px]">{i+1}</span>
              {opt}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-slate-700">
        <p className="text-sm text-sky-400/80 code-font">
          {">"} {gameState.message}
        </p>
      </div>
    </div>
  );
};

export default GameDisplay;
