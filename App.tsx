
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, Type, FunctionDeclaration } from '@google/genai';
import { GameState, TutorMood } from './types';
import MagicAvatar from './components/MagicAvatar';
import GameDisplay from './components/GameDisplay';
import { 
  createPcmBlob, 
  decodeAudioData, 
  decodeBase64 
} from './utils/audioUtils';
import { Mic, MicOff, Zap, Shield, Target, Cpu, ChevronUp } from 'lucide-react';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const updateGameFunction: FunctionDeclaration = {
  name: 'updateGameUI',
  parameters: {
    type: Type.OBJECT,
    description: 'Atualiza o status da missão e o nível de dificuldade do Pedro.',
    properties: {
      gameType: {
        type: Type.STRING,
        enum: ['WORD_SEARCH', 'SCRAMBLE', 'RIDDLE', 'READ_ALOUD', 'IDLE'],
      },
      currentWord: {
        type: Type.STRING,
        description: 'Texto principal. Comece fácil (Nível 1) e aumente conforme sucesso.',
      },
      grid: {
        type: Type.ARRAY,
        items: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
      },
      message: {
        type: Type.STRING,
        description: 'Feedback curto. Se ele errar, seja encorajador e simplifique.',
      },
      levelUpdate: {
        type: Type.INTEGER,
        description: 'O nível atual de dificuldade (1 a 5).',
      },
      progressIncrement: {
        type: Type.INTEGER,
        description: 'Quanto de progresso dar para essa resposta (10 a 30).',
      },
      options: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      }
    },
    required: ['gameType', 'currentWord', 'message', 'levelUpdate', 'progressIncrement'],
  },
};

const App: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mood, setMood] = useState<TutorMood>(TutorMood.HAPPY);
  const [gameState, setGameState] = useState<GameState>({
    currentWord: null,
    points: 0,
    level: 1,
    progressNextLevel: 0,
    message: 'Sistema Orion pronto. Aguardando inicialização do Pedro.',
    gameType: 'IDLE'
  });

  const sessionRef = useRef<any>(null);
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const startTutor = async () => {
    if (isActive) return;
    
    try {
      audioContextInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
          },
          systemInstruction: `Você é o "Mentor Orion". Sua missão é ensinar leitura ao Pedro Henrique (8 anos) de forma GRADUAL.
          ESTRATÉGIA DE NÍVEIS:
          - NÍVEL 1: Palavras curtas (ex: CASA, BOLA), rimas simples, frases de no máximo 3 palavras.
          - NÍVEL 2: Palavras com dígrafos (CH, LH, NH, RR) e frases de até 5 palavras.
          - NÍVEL 3: Pequenos enigmas e textos de 2 linhas para leitura fluida.
          - NÍVEL 4+: Caça-palavras (WORD_SEARCH) e interpretação.

          REGRAS CRÍTICAS:
          1. Comece SEMPRE no Nível 1. Não pule etapas.
          2. Se o Pedro acertar 2 vezes seguidas, suba o progresso. Quando chegar a 100%, suba o Nível.
          3. SE O PEDRO ERRAR: Simplifique imediatamente. Se ele travou numa palavra difícil, mude para uma fácil no próximo turno.
          4. Seja direto e curto. Exemplos: "Alvo atingido, Pedro. Próxima missão.", "Quase! Vamos tentar uma mais simples?".
          5. Use 'updateGameUI' em cada interação para refletir o nível e progresso.`,
          tools: [{ functionDeclarations: [updateGameFunction] }]
        },
        callbacks: {
          onopen: () => {
            setIsActive(true);
            const source = audioContextInRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextInRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              sessionPromise.then(session => session.sendRealtimeInput({ media: createPcmBlob(inputData) }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextInRef.current!.destination);
          },
          onmessage: async (msg) => {
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                if (fc.name === 'updateGameUI') {
                  const args = fc.args as any;
                  
                  setGameState(prev => {
                    let newProgress = prev.progressNextLevel + (args.progressIncrement || 0);
                    let newLevel = args.levelUpdate || prev.level;
                    
                    if (newProgress >= 100) {
                      newProgress = 0;
                      newLevel = Math.min(newLevel + 1, 5);
                    }

                    return {
                      ...prev,
                      gameType: args.gameType,
                      currentWord: args.currentWord,
                      message: args.message,
                      grid: args.grid,
                      options: args.options,
                      level: newLevel,
                      progressNextLevel: newProgress,
                      points: prev.points + (args.progressIncrement > 0 ? 10 : 0)
                    };
                  });
                  
                  if (args.progressIncrement > 0) {
                    setMood(TutorMood.CELEBRATING);
                    setTimeout(() => setMood(TutorMood.HAPPY), 2000);
                  }

                  sessionPromise.then(session => session.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { status: 'calibrated' } }
                  }));
                }
              }
            }

            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              setIsSpeaking(true);
              const ctx = audioContextOutRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decodeBase64(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsSpeaking(false);
              };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }
          },
          onclose: () => setIsActive(false)
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
    }
  };

  const stopTutor = () => {
    sessionRef.current?.close();
    setIsActive(false);
    setIsSpeaking(false);
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center p-4">
      {/* Header */}
      <header className="w-full max-w-5xl flex justify-between items-center py-6 px-4 md:px-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-500 rounded-lg">
            <Cpu className="text-slate-900" size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tighter uppercase code-font">
              Orion <span className="text-sky-500">v2.1</span>
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4 bg-slate-800/50 border border-slate-700/50 px-4 py-2 rounded-xl">
          <div className="flex items-center gap-2 border-r border-slate-700 pr-4">
            <ChevronUp className="text-sky-500" size={16} />
            <span className="text-xs font-bold text-white">Lvl {gameState.level}</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="text-emerald-500" size={16} />
            <span className="text-xs font-bold text-white">{gameState.points} XP</span>
          </div>
        </div>
      </header>

      {/* Main Mission Control */}
      <main className="flex-1 w-full max-w-5xl flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16">
        
        <div className="flex flex-col items-center">
          <MagicAvatar mood={mood} isSpeaking={isSpeaking} />
          
          <button
            onClick={isActive ? stopTutor : startTutor}
            className={`mt-8 flex items-center justify-center w-20 h-20 rounded-2xl transition-all duration-300 transform active:scale-95 shadow-xl ${
              isActive 
                ? 'bg-red-500/20 border-2 border-red-500 text-red-500' 
                : 'bg-sky-500 border-2 border-sky-400 text-slate-900 hover:bg-sky-400'
            }`}
          >
            {isActive ? <MicOff size={32} /> : <Mic size={32} />}
          </button>
          
          <p className="mt-4 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
            {isActive ? 'Link de Voz Estabilizado' : 'Conectar com Orion'}
          </p>
        </div>

        <div className="flex-1 w-full flex flex-col items-center max-w-lg">
          <GameDisplay gameState={gameState} />
          
          <div className="mt-8 grid grid-cols-2 gap-3 w-full opacity-60">
            <div className="bg-slate-800/30 p-3 rounded-xl border border-slate-700/50 flex items-center gap-3">
              <Zap className="text-sky-400" size={14} />
              <span className="text-[9px] text-slate-400 font-bold uppercase">Calibração Automática</span>
            </div>
            <div className="bg-slate-800/30 p-3 rounded-xl border border-slate-700/50 flex items-center gap-3">
              <Shield className="text-emerald-400" size={14} />
              <span className="text-[9px] text-slate-400 font-bold uppercase">Modo Seguro Ativo</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-6 text-slate-700 text-[9px] font-bold uppercase tracking-[0.4em]">
        Interface de Treino Adaptativa // Pedro H.
      </footer>
    </div>
  );
};

export default App;
