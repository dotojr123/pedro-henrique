
export interface GameState {
  currentWord: string | null;
  points: number;
  message: string;
  gameType: 'WORD_SEARCH' | 'SCRAMBLE' | 'RIDDLE' | 'READ_ALOUD' | 'IDLE';
  grid?: string[][]; // Para o Caça-Palavras
  options?: string[];
}

export enum TutorMood {
  HAPPY = 'HAPPY',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  CELEBRATING = 'CELEBRATING'
}
