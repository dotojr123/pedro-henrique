
export interface GameState {
  currentWord: string | null;
  points: number;
  level: number;
  progressNextLevel: number; // 0 a 100
  message: string;
  gameType: 'WORD_SEARCH' | 'SCRAMBLE' | 'RIDDLE' | 'READ_ALOUD' | 'IDLE';
  grid?: string[][];
  options?: string[];
}

export enum TutorMood {
  HAPPY = 'HAPPY',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  CELEBRATING = 'CELEBRATING'
}
