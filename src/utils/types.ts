export type Drug = {
  id: string;
  name: string;
  questions: any[];
};

type SelectedQuestion = {
  id: string; 
  title: string; 
  questionType: string; 
};

export type QuestionsData = {
  patientId: string;
  selectedQuestions: SelectedQuestion[]; 
};

export type Question = {
  id: string;
  title: string;
  questionType: string;
};

export interface SurveyInput {
  title: string;
  drugsIds: string[];
  patientId: string;
  period: string;
  questions: Array<{
    questionId: string;
    questionType: string;
    criticalIndicators?: any;
  }>;
  startAt: string;
  endAt: string;
  timezoneOffset: number;
}

export enum SurveyStep {
  START,
  START_DATE,
  END_DATE,
  PERIOD,
  COMPLETE,
}

export type NewPatient = {
  email: string;
  firstname?: string;
  lastname?: string;
  medicalCardNumber: string;
};
