
export interface GameState {
  currentWord: string | null;
  points: number;
  message: string;
  gameType: 'SYLLABLES' | 'COMPLETE_WORD' | 'GUESS_OBJECT' | 'READ_ALOUD' | 'IDLE';
  options?: string[];
}

export enum TutorMood {
  HAPPY = 'HAPPY',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  CELEBRATING = 'CELEBRATING'
}
