import axios from "axios";
import { GRAPHQL_ENDPOINT } from "../config/env";
import {AUTH_SERVICE} from '../config/env'
import TelegramBot from "node-telegram-bot-api";
import {
  GetQuestionAnswersResponse,
  GetQuestionAnswersVariables,
} from "./types";

export const signUpDoctor = async (email: string, password: string) => {
 
  try{
    const response = await fetch(`${AUTH_SERVICE}/doctors/register`, {
      body: JSON.stringify({email, password}),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST'
    })
    
    if (!response.ok) {
      const errorText = await response.text(); // Читаем текст ошибки
      console.error('Ошибка при запросе:', errorText);
      throw new Error(`Ошибка: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка в register Doctor:', error);
    throw error;
  }
};

export const findPatientByEmail = async (email: string, token: string) => {
 
  try{
    const response = await fetch(`${AUTH_SERVICE}/doctors/find-patient`, {
      body: JSON.stringify({email}),
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + token
      },
      method: 'POST'
    })
    
    if (!response.ok) {
      const errorText = await response.text(); // Читаем текст ошибки
      console.error('Ошибка при запросе:', errorText);
      throw new Error(`Ошибка: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка в register Doctor:', error);
    throw error;
  }
};

export const assignPatientToDoctor = async (patientId: string, doctorId: string, token: string) => {
 
  try{
    const response = await fetch(`${AUTH_SERVICE}/doctors/assign-patient`, {
      body: JSON.stringify({patientId, doctorId}),
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + token
      },
      method: 'POST'
    })
    
    if (!response.ok) {
      const errorText = await response.text(); // Читаем текст ошибки
      console.error('Ошибка при запросе:', errorText);
      throw new Error(`Ошибка: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка в assign patient:', error);
    throw error;
  }
};

export const signUpPatient = async (email: string, firstName: string, lastName: string, medicalCardNumber: string, password: string) => {
 
  try{
    const response = await fetch(`${AUTH_SERVICE}/patients/register`, {
      body: JSON.stringify({email, firstName, lastName, medicalCardNumber, password}),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST'
    })
    
    if (!response.ok) {
      const errorText = await response.text(); // Читаем текст ошибки
      console.error('Ошибка при запросе:', errorText);
      throw new Error(`Ошибка: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка в register Patient:', error);
    throw error;
  }
};

// export const loginDoctor = async (email: string, password: string) => {
//   const response = await axios.post(GRAPHQL_ENDPOINT as string, {
//     query: `
//       mutation DoctorEmailSignIn($input: DoctorEmailSignInInput!) {
//         doctorEmailSignIn(input: $input) {
//           token
//           user {
//             id
//             email
//             role
//           }
//         }
//       }
//     `,
//     variables: {
//       input: { email, password },
//     },
//   });
//   return response.data.data.doctorEmailSignIn;
// };
export const loginDoctor = async (email: string, password: string) => {
 
  try{
    const response = await fetch(`${AUTH_SERVICE}/doctors/login`, {
      body: JSON.stringify({email, password}),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST'
    })
    
    if (!response.ok) {
      const errorText = await response.text(); // Читаем текст ошибки
      console.error('Ошибка при запросе:', errorText);
      throw new Error(`Ошибка: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка в loginDoctor:', error);
    throw error;
  }
};

// export const loginPatient = async (email: string, password: string) => {
//   const response = await axios.post(GRAPHQL_ENDPOINT as string, {
//     query: `
//       mutation PatientEmailSignIn($input: PatientEmailSignInInput!) {
//         patientEmailSignIn(input: $input) {
//           token
//           refreshToken
//           user {
//             id
//             email
//             role
//           }
//         }
//       }
//     `,
//     variables: {
//       input: { email, password },
//     },
//   });
//   return response.data.data.patientEmailSignIn;
// };

export const loginPatient = async (email: string, password: string) => {
  try{
    const response = await fetch(`${AUTH_SERVICE}/patients/login`, {
      body: JSON.stringify({email, password}),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST'
    })
    
    if (!response.ok) {
      const errorText = await response.text(); // Читаем текст ошибки
      console.error('Ошибка при запросе:', errorText);
      throw new Error(`Ошибка: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка в loginDoctor:', error);
    throw error; 
  }
};

export const getHospitalPatients = async (doctorId: string, token: string) => {
  const response = await axios.post(
    GRAPHQL_ENDPOINT as string,
    {
      query: `
        query GetHospitalPatients($doctorId: ID!) {
          doctorFindHospitalPatient(doctorId: $doctorId) {
            id
            email
          }
        }
      `,
      variables: {
        doctorId,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data.data.doctorFindHospitalPatient;
};

export const searchPatients = async (
  filter: string,
  first: number,
  token: string
) => {
  const response = await axios.post(
    GRAPHQL_ENDPOINT as string,
    {
      query: `
        query SearchPatients($after: String, $filter: String!, $first: Int) {
          searchPatient(after: $after, filter: $filter, first: $first) {
            nodes {
              ...Patient
              __typename
            }
            pageInfo {
              endCursor
              hasNextPage
              __typename
            }
            __typename
          }
        }
        fragment Patient on HospitalPatientModel {
          createdAt
          hospitalId
          doctorId
          patientId
          medicalCardNumber
          firstName
          lastName
          id
          hasActiveSurvey
          __typename
        }
        

      `,
      variables: {
        filter,
        first,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data?.data?.searchPatient;
};

export const fetchDoctorNotifications = async (
  doctorId: string,
  first: number,
  after: string | null,
  token: string
) => {
  const response = await axios.post(
    GRAPHQL_ENDPOINT as string,
    {
      query: `
      query GetNotifications($after: String, $first: Int) {
        doctorGetNotifications(after: $after, first: $first) {
          pageInfo {
            hasNextPage
            endCursor
            __typename
          }
          nodes {
            ...Notification
            __typename
          }
          __typename
        }
      }
      
      fragment Notification on DoctorNotificationModel {
        createdAt
        description
        doctorId
        extraData {
          surveyTemplateId
          __typename
        }
        hospitalPatient {
          ...Patient
          __typename
        }
        id
        isRead
        kind
        patientId
        title
        __typename
      }
      
      fragment Patient on HospitalPatientModel {
        createdAt
        hospitalId
        doctorId
        patientId
        medicalCardNumber
        firstName
        lastName
        id
        hasActiveSurvey
        __typename
      }
      

    `,
      variables: {
        first,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data?.data?.doctorGetNotifications;
};

export const fetchPatientNotifications = async (
  first: number,
  token: string
) => {
  const response = await axios.post(
    GRAPHQL_ENDPOINT as string,
    {
      query: `
      query GetNotifications($after: String, $first: Int) {
        patientGetNotifications(after: $after, first: $first) {
          nodes {
            createdAt
            description
            extraData {
              surveyId
            }
            id
            isRead
            kind
            patientId
            title
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
    }

    `,
      variables: {
        first,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data?.data?.patientGetNotifications;
};

export const fetchPatientSurveys = async (
  patientId: string,
  surveyTemplateId: string | null,
  token: string
) => {
  try {
    const response = await axios.post(
      GRAPHQL_ENDPOINT as string,
      {
        query: `
        query GetPassedSurveyTemplatesForPatient($patientId: UUID!) {
          doctorFindPatientPrivateSurveyTemplates(patientId: $patientId) {
            ...SurveyTemplate
            __typename
          }
        }
        
        fragment SurveyTemplate on SurveyTemplateModel {
          id
          kind
          period
          title
          createdAt
          endAt
          startAt
          drugs {
            ...Drug
            __typename
          }
          questionsCount
          questions {
            criticalAnswerId
            criticalAnswersIds
            criticalIndicators {
              numeric {
                maxValue
                minValue
                __typename
              }
              scale {
                value
                __typename
              }
              __typename
            }
            question {
              ...Question
              __typename
            }
            __typename
          }
          timezoneOffset
          __typename
        }
        
        fragment Drug on DrugModel {
          id
          name
          __typename
        }
        
        fragment Question on QuestionModel {
          id
          title
          type
          isCustom
          indicators {
            numeric {
              maxValue
              minValue
              __typename
            }
            scale {
              maxValue
              minValue
              __typename
            }
            __typename
          }
          options {
            id
            index
            text
            __typename
          }
          isActual
          __typename
        }
        
      `,
        variables: {
          patientId: patientId,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data.errors) {
      console.error("Ошибки в ответе сервера:", response.data.errors);
      throw new Error("Ошибка в GraphQL-запросе");
    }

    return response.data?.data?.doctorFindPatientPrivateSurveyTemplates;
  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
    throw error;
  }
};

export const fetchOneSurveyAnswers = async (
  patientId: string,
  surveyTemplateId: string | null,
  token: string
) => {
  try {
    const response = await axios.post(
      GRAPHQL_ENDPOINT as string,
      {
        query: `query GetSurveyAnswers($patientId: UUID!, $surveyTemplateId: UUID) {
          doctorFindPatientSurveyAnswers(
            patientId: $patientId
            surveyTemplateId: $surveyTemplateId
          ) {
            answerQuestionOptionText
            answerQuestionOptionsTexts
            answerValue {
              ...AnswerValue
              __typename
            }
            maxAnswer
            minAnswer
            questionId
            questionTitle
            questionType
            isQuestionCustom
            isCritical
            __typename
          }
        }
        
        fragment AnswerValue on SurveyAnswerValue {
          numeric {
            value
            __typename
          }
          pressure {
            lowerValue
            upperValue
            __typename
          }
          pulse {
            value
            __typename
          }
          scale {
            value
            __typename
          }
          temperature {
            value
            __typename
          }
          weight {
            value
            __typename
          }
          __typename
        }
        

      `,
        variables: {
          patientId: patientId,
          surveyTemplateId: surveyTemplateId ?? null,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data.errors) {
      console.error("Ошибки в ответе сервера:", response.data.errors);
      throw new Error("Ошибка в GraphQL-запросе");
    }

    return response.data?.data?.doctorFindPatientSurveyAnswers;
  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
    throw error;
  }
};

export const fetchDrugs = async (token: string) => {
  try {
    const response = await axios.post(
      GRAPHQL_ENDPOINT as string,
      {
        query: `query GetDrugsFromDB($filter: String) {
          drugsSearch(filter: $filter) {
            id
            name
            __typename
          }
        }
        `,
        variables: {},
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data.errors) {
      console.error("Ошибки в ответе сервера:", response.data.errors);
      throw new Error("Ошибка в GraphQL-запросе");
    }

    const res = response.data?.data?.drugsSearch;

    // ХАРДКОД УБРАТЬ!
    const filtered = res.filter(
      (item: any) => item.name?.indexOf("Космето") >= 0
    );

    return res;
  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
    throw error;
  }
};

export const fetchQuestionsByDrug = async (token: string, id: string) => {
  try {
    const response = await axios.post(
      GRAPHQL_ENDPOINT as string,
      {
        query: `query GetDrugQuestions($id: UUID!) {
          drugFindQuestions(id: $id) {
            ...Question
            __typename
          }
        }
        
        fragment Question on QuestionModel {
          id
          title
          type
          isCustom
          indicators {
            numeric {
              maxValue
              minValue
              __typename
            }
            scale {
              maxValue
              minValue
              __typename
            }
            __typename
          }
          options {
            id
            index
            text
            __typename
          }
          isActual
          __typename
        }
        `,
        variables: {
          id,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data.errors) {
      console.error("Ошибки в ответе сервера:", response.data.errors);
      throw new Error("Ошибка в GraphQL-запросе");
    }

    return response.data?.data?.drugFindQuestions;
  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
    throw error;
  }
};

export const sendSurveyToPatient = async (token: string, input: object) => {
  try {
    const response = await axios.post(
      GRAPHQL_ENDPOINT as string,
      {
        query: `
          mutation SendSurveyToPatient($input: DoctorCreateSurveyTemplateInput!) {
                        doctorCreatePrivateSurveyTemplate(input: $input) {
                            problem {
                                message
                                __typename
                            }
                            surveyTemplate {
                                id
                                kind
                                period
                                title
                                createdAt
                                endAt
                                startAt
                                drugs {
                                    id
                                    name
                                    __typename
                                }
                                questionsCount
                                questions {
                                    criticalAnswerId
                                    criticalAnswersIds
                                    criticalIndicators {
                                        numeric {
                                            maxValue
                                            minValue
                                            __typename
                                        }
                                        scale {
                                            value
                                            __typename
                                        }
                                        __typename
                                    }
                                    question {
                                        id
                                        title
                                        type
                                        isCustom
                                        indicators {
                                            numeric {
                                                maxValue
                                                minValue
                                                __typename
                                            }
                                            scale {
                                                maxValue
                                                minValue
                                                __typename
                                            }
                                            __typename
                                        }
                                        options {
                                            id
                                            index
                                            text
                                            __typename
                                        }
                                        isActual
                                        __typename
                                    }
                                    __typename
                                }
                                timezoneOffset
                                __typename
                            }
                            __typename
                        }
                    }
        `,
        variables: { input },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.data.errors) {
      console.error("Ошибки в ответе сервера:", response.data.errors);
      throw new Error("Ошибка в GraphQL-запросе");
    }

    const surveyTemplate =
      response.data.data.doctorCreatePrivateSurveyTemplate.surveyTemplate;

    if (surveyTemplate) {
      return { success: true, surveyTemplate: surveyTemplate };
    } else {
      return { success: false, error: "Не удалось создать шаблон опроса." };
    }
  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
    throw error;
  }
};

export const invitePatient = async (token: string, input: object) => {
  try {
    const response = await axios.post(
      GRAPHQL_ENDPOINT as string,
      {
        query: `
          mutation CreatePatient($input: PatientCreateInput!) {
            patientCreate(input: $input) {
              problem {
                ... on ExistEmailProblem {
                  message
                  __typename
                }
                ... on TooManyRequestsProblem {
                  message
                  __typename
                }
                __typename
              }
              __typename
            }
          }
        `,
        variables: { input },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log(JSON.stringify(response));

    return response.data;
  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
    console.log(JSON.stringify(error));
    throw error;
  }
};

export const myActiveSurveys = async (token: string) => {
  try {
    const response = await axios.post(
      GRAPHQL_ENDPOINT as string,
      {
        query: `query PatientFindActiveSurvey {
           patientFindActiveSurvey {
            id
            createdAt
            template {
              id
              title
              kind
              period
              startAt
              endAt
              timezoneOffset
              questionsCount
              questions {
                criticalAnswerId
                criticalAnswersIds
                criticalIndicators {
                  numeric {
                    maxValue
                    minValue
                  }
                  pressure {
                    minUpperValue
                    maxUpperValue
                    maxLowerValue
                    minLowerValue
                  }
                  pulse {
                    maxValue
                    minValue
                  }
                  scale {
                    value
                  }
                  temperature {
                    maxValue
                    minValue
                  }
                  weight {
                    maxValue
                    minValue
                  }
                }
                question {
                  id
                  title
                  type
                  isActual
                  isCustom
                  options {
                    id
                    index
                    text
                  }
                  indicators {
                    numeric {
                      maxValue
                      minValue
                    }
                    pressure {
                      lowerMaxValue
                      upperMaxValue
                      lowerMinValue
                      upperMinValue
                    }
                    scale {
                      minValue
                      maxValue
                    }
                    temperature {
                      maxValue
                      minValue
                    }
                  }
                }
              }
            }
          }
        }
        `,
        variables: {},
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log(response.data);
    console.log(response.data?.data?.patientFindActiveSurvey?.template);

    return response.data?.data?.patientFindActiveSurvey;
  } catch (error) {
    console.log(error);
    console.error("Ошибка при выполнении запроса:", error);
    throw error;
  }
};

export const sendSurveyAnswers = async (token: string, input: object) => {
  try {
    console.log("Отправка запроса на сервер:", JSON.stringify(input, null, 2));

    const response = await axios.post(
      GRAPHQL_ENDPOINT as string,
      {
        query: `mutation PatientCompleteSurvey($input: PatientCompleteSurveyInput!) {
            patientCompleteSurvey(input: $input) {
              problem {
                message
              }
              success
            }
          }
        `,
        variables: { input },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log("Ответ сервера:", JSON.stringify(response.data, null, 2));

    return response;
  } catch (error: any) {
    console.error("Ошибка при выполнении запроса:", error.message);
    if (error.response) {
      console.error(
        "Ответ сервера:",
        JSON.stringify(error.response.data, null, 2)
      );
      throw new Error(
        error.response.data.errors?.[0]?.message || error.message
      );
    } else {
      throw new Error(error.message);
    }
  }
};

export const contactMeRequest = async (
  token: string,
  doctorId: string,
  message: string
) => {
  try {
    const response = await axios.post(
      GRAPHQL_ENDPOINT as string,
      {
        query: `mutation ContactMe($doctorId: String!, $message: String!) {
          patientSendContactMeRequest(doctorId: $doctorId, message: $message) {
            success
            problem {
              message
            }
          }
        }
        `,
        variables: { doctorId, message },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data?.data?.patientSendContactMeRequest;
  } catch (error) {
    console.log(error);
    console.error("Ошибка при выполнении запроса:", error);
    throw error;
  }
};

export const getMyDoc = async (token: string) => {
  try {
    const response = await axios.post(
      GRAPHQL_ENDPOINT as string,
      {
        query: `query MyDoc {
          patientDoctors {
            doctorId
            id
            patientId
          }
        }
        `,
        variables: {},
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data?.data?.patientDoctors;
  } catch (error) {
    console.log(error);
    console.error("Ошибка при выполнении запроса:", error);
    throw error;
  }
};

export const getQuestionAnswers = async (
  token: string,
  variables: GetQuestionAnswersVariables
): Promise<GetQuestionAnswersResponse> => {
  try {
    const response = await axios.post(
      GRAPHQL_ENDPOINT as string,
      {
        operationName: "GetQuestionAnswers",
        query: `
          query GetQuestionAnswers(
            $endAt: DateTime
            $patientId: UUID!
            $questionId: UUID!
            $startAt: DateTime
            $surveyTemplateId: String
            $after: String
            $take: Int
          ) {
            doctorFindPatientQuestionAnswers(
              endAt: $endAt
              patientId: $patientId
              questionId: $questionId
              startAt: $startAt
              surveyTemplateId: $surveyTemplateId
              after: $after
              take: $take
            ) {
              pageInfo {
                endCursor
                hasNextPage
                __typename
              }
              nodes {
                id
                isCritical
                questionId
                surveyId
                createdAt
                answerQuestionOption {
                  id
                  index
                  text
                  __typename
                }
                answerQuestionOptionId
                answerQuestionOptions {
                  id
                  index
                  text
                  __typename
                }
                answerQuestionOptionsIds
                answerValue {
                  ...AnswerValue
                  __typename
                }
                __typename
              }
              __typename
            }
          }

          fragment AnswerValue on SurveyAnswerValue {
            numeric {
              value
              __typename
            }
            pressure {
              lowerValue
              upperValue
              __typename
            }
            pulse {
              value
              __typename
            }
            scale {
              value
              __typename
            }
            temperature {
              value
              __typename
            }
            weight {
              value
              __typename
            }
            __typename
          }
        `,
        variables,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error("Ошибка при выполнении запроса:", error);
    if (error.response) {
      console.error("Ответ сервера:", error.response.data);
      throw new Error(
        error.response.data.errors?.[0]?.message ||
          "Ошибка при выполнении запроса"
      );
    } else {
      throw new Error(error.message);
    }
  }
};

export const fetchAllQuestionAnswers = async (
  patientId: string,
  token: string,
  anotherSurvey: any[]
) => {
  try {
    // Массив для хранения результатов
    const allQuestionAnswers = [];

    // Проходим по каждому вопросу в массиве anotherSurvey
    for (const item of anotherSurvey) {
      const variables: GetQuestionAnswersVariables = {
        patientId: patientId,
        questionId: item.questionId, // Используем questionId из текущего элемента
        take: 5,
      };

      // Выполняем запрос для текущего вопроса
      const response = await getQuestionAnswers(token, variables);

      // Добавляем результат в массив
      allQuestionAnswers.push({
        questionTitle: item.questionTitle,
        minAnswer: item.minAnswer,
        maxAnswer: item.maxAnswer,
        answers: response.data.doctorFindPatientQuestionAnswers.nodes,
      });
    }

    return allQuestionAnswers;
  } catch (error) {
    console.error("Ошибка при выполнении запросов:", error);
    throw error;
  }
};

