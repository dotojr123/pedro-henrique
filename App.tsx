
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
import { Mic, MicOff, Zap, Shield, Target, Cpu } from 'lucide-react';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const updateGameFunction: FunctionDeclaration = {
  name: 'updateGameUI',
  parameters: {
    type: Type.OBJECT,
    description: 'Atualiza a interface de missões de leitura para o Pedro Henrique.',
    properties: {
      gameType: {
        type: Type.STRING,
        enum: ['WORD_SEARCH', 'SCRAMBLE', 'RIDDLE', 'READ_ALOUD', 'IDLE'],
      },
      currentWord: {
        type: Type.STRING,
        description: 'A palavra, frase ou pergunta principal.',
      },
      grid: {
        type: Type.ARRAY,
        items: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        },
        description: 'Grid 5x5 de letras se for Word Search.',
      },
      message: {
        type: Type.STRING,
        description: 'Instrução curta e objetiva do mentor.',
      },
      options: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Opções de resposta ou dicas.',
      }
    },
    required: ['gameType', 'currentWord', 'message'],
  },
};

const App: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mood, setMood] = useState<TutorMood>(TutorMood.HAPPY);
  const [gameState, setGameState] = useState<GameState>({
    currentWord: null,
    points: 0,
    message: 'Aguardando comando de inicialização...',
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
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }, // Voz mais neutra/cool
          },
          systemInstruction: `Você é o "Mentor Orion", um treinador de leitura avançado para o Pedro Henrique (8 anos).
          Pedro já sabe ler, mas precisa de desafios que estimulem a velocidade e interpretação.
          DIRETRIZES:
          1. PERSONA: Direto, técnico e incentivador. Use termos como "Missão", "Sincronização", "Nível".
          2. COMUNICAÇÃO: Frases curtas. Não encha linguiça. Se ele acertar, diga "Alvo atingido. Excelente leitura".
          3. MISSÕES:
             - WORD_SEARCH: Crie um grid 5x5 e esconda uma palavra. Peça para ele achar.
             - SCRAMBLE: Dê uma frase curta bagunçada e peça para ele ler na ordem certa.
             - RIDDLE: Dê uma charada curta que ele precise ler e interpretar.
          4. DIDÁTICA: Explique brevemente o porquê de uma regra gramatical se ele errar, mas sem palestras.
          5. Chame-o de Pedro. Não use voz infantilizada. Trate-o como um jovem explorador de dados.`,
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
                  setGameState(prev => ({
                    ...prev,
                    gameType: args.gameType,
                    currentWord: args.currentWord,
                    message: args.message,
                    grid: args.grid,
                    options: args.options
                  }));
                  
                  if (args.message.toLowerCase().includes('excelente') || args.message.toLowerCase().includes('atingido')) {
                    setMood(TutorMood.CELEBRATING);
                    setGameState(prev => ({ ...prev, points: prev.points + 25 }));
                    setTimeout(() => setMood(TutorMood.HAPPY), 2000);
                  }

                  sessionPromise.then(session => session.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { status: 'synchronized' } }
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
      <header className="w-full max-w-5xl flex justify-between items-center py-8 px-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-500 rounded-xl shadow-[0_0_15px_rgba(14,165,233,0.5)]">
            <Cpu className="text-slate-900" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight uppercase">
              Orion <span className="text-sky-500">Core</span>
            </h1>
            <div className="text-[10px] text-sky-500/60 font-bold tracking-widest uppercase">Protocolo de Leitura</div>
          </div>
        </div>
        
        <div className="flex items-center gap-8 bg-slate-800/80 border border-slate-700 px-6 py-3 rounded-xl backdrop-blur-sm">
          <div className="flex items-center gap-3 border-r border-slate-700 pr-6">
            <Target className="text-sky-500" size={18} />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Sincronia</span>
              <span className="text-sm font-bold text-white">{gameState.points} XP</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Shield className="text-emerald-500" size={18} />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Usuário</span>
              <span className="text-sm font-bold text-white">Pedro H.</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Mission Control */}
      <main className="flex-1 w-full max-w-5xl flex flex-col lg:flex-row items-center justify-center gap-16">
        
        {/* Mentor Panel */}
        <div className="flex flex-col items-center">
          <MagicAvatar mood={mood} isSpeaking={isSpeaking} />
          
          <button
            onClick={isActive ? stopTutor : startTutor}
            className={`mt-10 group relative flex items-center justify-center w-24 h-24 rounded-2xl transition-all duration-300 transform active:scale-95 shadow-xl ${
              isActive 
                ? 'bg-red-500/20 border-2 border-red-500 text-red-500' 
                : 'bg-sky-500/10 border-2 border-sky-500 text-sky-500 hover:bg-sky-500 hover:text-white'
            }`}
          >
            {isActive ? <MicOff size={36} /> : <Mic size={36} />}
            <div className={`absolute -inset-4 rounded-full border border-sky-500/20 animate-ping ${!isActive && 'hidden'}`}></div>
          </button>
          
          <p className="mt-6 text-slate-500 text-xs font-bold uppercase tracking-widest">
            {isActive ? 'Link Ativo' : 'Iniciar Conexão'}
          </p>
        </div>

        {/* Tactical Display */}
        <div className="flex-1 w-full flex flex-col items-center">
          <GameDisplay gameState={gameState} />
          
          <div className="mt-10 grid grid-cols-2 gap-4 w-full">
            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 flex items-center gap-4">
              <Zap className="text-yellow-500" size={20} />
              <div className="text-[10px] text-slate-400 font-bold uppercase leading-tight">
                Processamento <br/> <span className="text-white">Tempo Real</span>
              </div>
            </div>
            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 flex items-center gap-4">
              <Target className="text-sky-500" size={20} />
              <div className="text-[10px] text-slate-400 font-bold uppercase leading-tight">
                Objetivo <br/> <span className="text-white">Fluidez 2.0</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-8 text-slate-600 text-[10px] font-bold uppercase tracking-[0.3em]">
        Orion-System © 2025 // Data-Flow Pedro
      </footer>
    </div>
  );
};

export default App;
