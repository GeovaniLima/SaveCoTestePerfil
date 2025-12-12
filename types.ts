export type UserRole = 'admin' | 'candidate' | null;

export type ViewState = 'dashboard' | 'candidates' | 'tests' | 'results' | 'candidate-login' | 'candidate-test' | 'candidate-complete' | 'admin-users';

export interface QuestionOption {
  text: string;
  value: string; // '0'-'10' or 'Analítico', 'Líder', etc.
}

export interface Question {
  id: string;
  text: string;
  category?: string; // New field for behavioral competency
  type: 'scale' | 'choice'; // scale 1-5 or multiple choice
  options?: QuestionOption[]; // Updated to support text + value pair
  variation?: 'single' | 'most_least'; // 'single' for one answer, 'most_least' for identifying traits
}

export interface Test {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  active: boolean;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  password?: string;
  status: 'pending' | 'in-progress' | 'completed';
  assignedTestId?: string;
  score?: number; // Simplified score for demo
  completedDate?: string;
}

export interface TestResult {
  candidateId: string;
  testId: string;
  answers: Record<string, any>;
  timestamp: string;
}

export enum ChartColor {
  Primary = '#10b981', // Emerald 500
  Secondary = '#3b82f6', // Blue 500
  Tertiary = '#6366f1', // Indigo 500
  Neutral = '#9ca3af', // Gray 400
}