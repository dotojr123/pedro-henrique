
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, Type, FunctionDeclaration } from '@google/genai';
import { GameState, TutorMood } from './types';
import MagicAvatar from './components/MagicAvatar';
import GameDisplay from './components/GameDisplay';
import { 
  createPcmBlob, 
  decodeAudioData, 
  decodeBase64 
} from './utils/audioUtils';
import { Mic, MicOff, Star, Trophy, Volume2, Sparkles } from 'lucide-react';

// Setup Gemini API (Key is injected)
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// Function declaration for Gemini to update the UI
const updateGameFunction: FunctionDeclaration = {
  name: 'updateGameUI',
  parameters: {
    type: Type.OBJECT,
    description: 'Atualiza o estado visual do jogo de leitura para o Pedro Henrique.',
    properties: {
      gameType: {
        type: Type.STRING,
        enum: ['SYLLABLES', 'COMPLETE_WORD', 'GUESS_OBJECT', 'READ_ALOUD', 'IDLE'],
        description: 'O tipo de brincadeira atual.',
      },
      currentWord: {
        type: Type.STRING,
        description: 'A palavra ou sílaba que o Pedro deve ler ou interagir.',
      },
      message: {
        type: Type.STRING,
        description: 'Uma instrução curta ou incentivo visual.',
      },
      options: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Opções de escolha se houver.',
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
    message: 'Pronto para começar?',
    gameType: 'IDLE'
  });

  const sessionRef = useRef<any>(null);
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Function to start the session
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
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: `Você é o "Professor Mágico", um tutor particular alegre e paciente para o Pedro Henrique, um menino de 8 anos que está com dificuldade na leitura.
          Sua missão é ensinar leitura de forma lúdica.
          REGRAS:
          1. Sempre use uma voz encorajadora.
          2. Comece cada interação chamando-o de Pedro ou Pedrinho.
          3. Crie jogos simples: 
             - Mostrar uma sílaba (ex: BA) e pedir para ele ler.
             - Mostrar uma palavra simples (BOLA) e pedir para ler.
             - Jogo da forca visual (completar letras).
          4. Sempre use a função 'updateGameUI' quando sugerir uma nova palavra ou atividade visual.
          5. Comemore muito quando ele acertar! Use palavras como "Incrível!", "Uau!", "Você é um gênio!".
          6. Se ele errar, diga: "Quase lá, vamos tentar de novo juntos?".`,
          tools: [{ functionDeclarations: [updateGameFunction] }]
        },
        callbacks: {
          onopen: () => {
            console.log('Session Opened');
            setIsActive(true);
            setMood(TutorMood.HAPPY);
            
            // Start audio stream to model
            const source = audioContextInRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextInRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextInRef.current!.destination);
          },
          onmessage: async (msg) => {
            // Handle tool calls
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                if (fc.name === 'updateGameUI') {
                  const args = fc.args as any;
                  setGameState(prev => ({
                    ...prev,
                    gameType: args.gameType,
                    currentWord: args.currentWord,
                    message: args.message,
                    options: args.options
                  }));
                  
                  // If it's a celebration message, change mood
                  if (args.message.toLowerCase().includes('uau') || args.message.toLowerCase().includes('parabéns')) {
                    setMood(TutorMood.CELEBRATING);
                    setGameState(prev => ({ ...prev, points: prev.points + 10 }));
                    setTimeout(() => setMood(TutorMood.HAPPY), 3000);
                  }

                  sessionPromise.then(session => session.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { status: 'ok' } }
                  }));
                }
              }
            }

            // Handle audio output
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
          onerror: (e) => console.error('Gemini Error:', e),
          onclose: () => {
            setIsActive(false);
            setIsSpeaking(false);
          }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error('Failed to start session:', err);
      alert('Por favor, permita o uso do microfone para brincar com o Professor!');
    }
  };

  const stopTutor = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setIsActive(false);
    setIsSpeaking(false);
    if (audioContextInRef.current) audioContextInRef.current.close();
    if (audioContextOutRef.current) audioContextOutRef.current.close();
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center p-4 overflow-hidden">
      {/* Background Blobs */}
      <div className="blob w-96 h-96 bg-sky-200 top-[-10%] left-[-10%]"></div>
      <div className="blob w-80 h-80 bg-orange-100 bottom-[-10%] right-[-10%] delay-1000"></div>
      <div className="blob w-64 h-64 bg-yellow-100 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30"></div>

      {/* Header */}
      <header className="w-full max-w-4xl flex justify-between items-center py-6 px-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-sky-500 rounded-lg text-white">
            <Sparkles size={24} />
          </div>
          <h1 className="title-font text-2xl text-sky-900 tracking-tight">
            Magileitura <span className="text-orange-500">Edu</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-6 bg-white/60 backdrop-blur px-6 py-2 rounded-full shadow-sm border border-white/40">
          <div className="flex items-center gap-2">
            <Trophy className="text-yellow-500" size={20} />
            <span className="font-bold text-sky-900">{gameState.points} pontos</span>
          </div>
          <div className="flex items-center gap-2">
            <Star className="text-orange-400 fill-orange-400" size={20} />
            <span className="font-bold text-sky-900">Pedro Henrique</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-4xl flex flex-col md:flex-row items-center justify-center gap-12 mt-4">
        
        {/* Tutor Side */}
        <div className="flex flex-col items-center">
          <MagicAvatar mood={mood} isSpeaking={isSpeaking} />
          
          <div className="mt-8 flex flex-col gap-4 items-center">
            <button
              onClick={isActive ? stopTutor : startTutor}
              className={`group relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 transform active:scale-95 shadow-lg ${
                isActive 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-sky-500 hover:bg-sky-600 hover:scale-105'
              }`}
            >
              {isActive ? (
                <MicOff className="text-white" size={32} />
              ) : (
                <Mic className="text-white" size={32} />
              )}
              {isActive && (
                <span className="absolute -bottom-12 whitespace-nowrap text-red-500 font-bold animate-pulse text-sm">
                  Ouvindo...
                </span>
              )}
            </button>
            
            {!isActive && (
              <p className="text-sky-700 font-medium animate-bounce mt-4">
                Clique no microfone para falar!
              </p>
            )}
          </div>
        </div>

        {/* Game Side */}
        <div className="flex-1 flex flex-col items-center w-full">
          <GameDisplay gameState={gameState} />
          
          <div className="mt-12 w-full grid grid-cols-3 gap-4">
             <div className="bg-white/40 p-4 rounded-2xl flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center mb-2">
                   <Volume2 className="text-orange-600" size={20} />
                </div>
                <span className="text-xs font-bold text-sky-800">Escute bem</span>
             </div>
             <div className="bg-white/40 p-4 rounded-2xl flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-sky-200 flex items-center justify-center mb-2">
                   <Sparkles className="text-sky-600" size={20} />
                </div>
                <span className="text-xs font-bold text-sky-800">Tente ler</span>
             </div>
             <div className="bg-white/40 p-4 rounded-2xl flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center mb-2">
                   <Star className="text-green-600" size={20} />
                </div>
                <span className="text-xs font-bold text-sky-800">Ganhe estrelas</span>
             </div>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="py-6 text-sky-400 text-sm font-medium">
        Criado com carinho para o Pedro Henrique ❤️
      </footer>

      {/* Floating Indicators */}
      {isSpeaking && (
        <div className="fixed bottom-10 right-10 flex gap-1 items-end h-8">
           {[...Array(5)].map((_, i) => (
             <div 
               key={i} 
               className="w-1.5 bg-orange-400 rounded-full animate-wave" 
               style={{ 
                 height: `${Math.random() * 100}%`,
                 animationDelay: `${i * 0.1}s`,
                 animationDuration: '0.5s'
               }} 
             />
           ))}
        </div>
      )}

      <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1.5); }
        }
        .animate-wave {
          animation: wave infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default App;
