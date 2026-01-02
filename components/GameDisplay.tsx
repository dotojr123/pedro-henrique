
import React from 'react';
import { GameState } from '../types';

interface GameDisplayProps {
  gameState: GameState;
}

const GameDisplay: React.FC<GameDisplayProps> = ({ gameState }) => {
  if (gameState.gameType === 'IDLE') {
    return (
      <div className="bg-slate-800/50 backdrop-blur-md p-8 rounded-2xl border border-slate-700 text-center max-w-md w-full">
        <h2 className="text-xl font-bold text-sky-400 mb-4 code-font">SISTEMA EM STANDBY</h2>
        <p className="text-slate-400 text-sm">Aguardando comando de voz do Pedro Henrique para iniciar Nível {gameState.level}.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-2xl max-w-lg w-full relative overflow-hidden">
      {/* Level Progress Bar at the top */}
      <div className="absolute top-0 left-0 w-full h-1 bg-slate-900">
        <div 
          className="h-full bg-sky-500 shadow-[0_0_10px_#0ea5e9] transition-all duration-500" 
          style={{ width: `${gameState.progressNextLevel}%` }}
        ></div>
      </div>

      <div className="flex justify-between items-center mb-6 mt-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-sky-500 uppercase tracking-widest bg-sky-500/10 px-2 py-0.5 rounded w-fit">
            Protocolo: {gameState.gameType.replace('_', ' ')}
          </span>
          <span className="text-[9px] text-slate-500 mt-1 font-bold uppercase">Dificuldade: Nível {gameState.level}</span>
        </div>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></div>
          <div className="text-[10px] text-sky-400 code-font">{gameState.progressNextLevel}% SYNC</div>
        </div>
      </div>
      
      <div className="min-h-[120px] flex items-center justify-center">
        {gameState.gameType === 'WORD_SEARCH' && gameState.grid ? (
          <div className="grid grid-cols-5 gap-2 bg-slate-900 p-3 rounded-xl w-full">
            {gameState.grid.flat().map((char, i) => (
              <div key={i} className="aspect-square flex items-center justify-center bg-slate-800 border border-slate-700 rounded text-lg font-bold text-sky-300">
                {char}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-3xl md:text-4xl font-bold text-white text-center leading-tight px-4">
            {gameState.currentWord}
          </div>
        )}
      </div>

      {gameState.options && gameState.options.length > 0 && (
        <div className="grid grid-cols-1 gap-2 mt-6">
          {gameState.options.map((opt, i) => (
            <div key={i} className="p-3 bg-slate-900 border border-slate-700 rounded-lg text-sm font-medium text-slate-300 flex items-center gap-3 hover:border-sky-500/50 transition-colors">
              <span className="w-5 h-5 flex items-center justify-center bg-sky-500/20 text-sky-500 rounded text-[10px] font-bold">{i+1}</span>
              {opt}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-slate-700/50">
        <p className="text-xs text-slate-400 italic">
          <span className="text-sky-500 font-bold mr-2">ORION:</span> 
          {gameState.message}
        </p>
      </div>
    </div>
  );
};

export default GameDisplay;
