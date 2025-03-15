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


export interface GetQuestionAnswersVariables {
  patientId: string;
  questionId: string;
  endAt?: string; // DateTime в формате ISO строки
  startAt?: string; // DateTime в формате ISO строки
  surveyTemplateId?: string;
  after?: string;
  take?: number;
}

export interface GetQuestionAnswersResponse {
  data: {
    doctorFindPatientQuestionAnswers: {
      pageInfo: {
        endCursor: string;
        hasNextPage: boolean;
        __typename: string;
      };
      nodes: Array<{
        id: string;
        isCritical: boolean;
        questionId: string;
        surveyId: string;
        createdAt: string;
        answerQuestionOption: {
          id: string;
          index: number;
          text: string;
          __typename: string;
        };
        answerQuestionOptionId: string;
        answerQuestionOptions: Array<{
          id: string;
          index: number;
          text: string;
          __typename: string;
        }>;
        answerQuestionOptionsIds: string[];
        answerValue: {
          numeric: {
            value: number;
            __typename: string;
          };
          pressure: {
            lowerValue: number;
            upperValue: number;
            __typename: string;
          };
          pulse: {
            value: number;
            __typename: string;
          };
          scale: {
            value: number;
            __typename: string;
          };
          temperature: {
            value: number;
            __typename: string;
          };
          weight: {
            value: number;
            __typename: string;
          };
          __typename: string;
        };
        __typename: string;
      }>;
      __typename: string;
    };
  };
}
