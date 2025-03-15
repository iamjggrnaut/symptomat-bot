"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyDoc = exports.contactMeRequest = exports.sendSurveyAnswers = exports.myActiveSurveys = exports.invitePatient = exports.sendSurveyToPatient = exports.fetchQuestionsByDrug = exports.fetchDrugs = exports.fetchOneSurveyAnswers = exports.fetchPatientSurveys = exports.fetchPatientNotifications = exports.fetchDoctorNotifications = exports.searchPatients = exports.getHospitalPatients = exports.loginPatient = exports.loginDoctor = void 0;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../config/env");
const userSessions = new Map();
const loginDoctor = async (email, password) => {
    const response = await axios_1.default.post(env_1.GRAPHQL_ENDPOINT, {
        query: `
      mutation DoctorEmailSignIn($input: DoctorEmailSignInInput!) {
        doctorEmailSignIn(input: $input) {
          token
          user {
            id
            email
            role
          }
        }
      }
    `,
        variables: {
            input: { email, password },
        },
    });
    return response.data.data.doctorEmailSignIn;
};
exports.loginDoctor = loginDoctor;
const loginPatient = async (email, password) => {
    const response = await axios_1.default.post(env_1.GRAPHQL_ENDPOINT, {
        query: `
      mutation PatientEmailSignIn($input: PatientEmailSignInInput!) {
        patientEmailSignIn(input: $input) {
          token
          refreshToken
          user {
            id
            email
            role
          }
        }
      }
    `,
        variables: {
            input: { email, password },
        },
    });
    return response.data.data.patientEmailSignIn;
};
exports.loginPatient = loginPatient;
const getHospitalPatients = async (doctorId, token) => {
    const response = await axios_1.default.post(env_1.GRAPHQL_ENDPOINT, {
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
    }, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.data.data.doctorFindHospitalPatient;
};
exports.getHospitalPatients = getHospitalPatients;
const searchPatients = async (filter, first, token) => {
    const response = await axios_1.default.post(env_1.GRAPHQL_ENDPOINT, {
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
    }, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.data?.data?.searchPatient;
};
exports.searchPatients = searchPatients;
const fetchDoctorNotifications = async (doctorId, first, after, token) => {
    const response = await axios_1.default.post(env_1.GRAPHQL_ENDPOINT, {
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
    }, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.data?.data?.doctorGetNotifications;
};
exports.fetchDoctorNotifications = fetchDoctorNotifications;
const fetchPatientNotifications = async (first, token) => {
    const response = await axios_1.default.post(env_1.GRAPHQL_ENDPOINT, {
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
    }, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return response.data?.data?.patientGetNotifications;
};
exports.fetchPatientNotifications = fetchPatientNotifications;
const fetchPatientSurveys = async (patientId, surveyTemplateId, token) => {
    try {
        const response = await axios_1.default.post(env_1.GRAPHQL_ENDPOINT, {
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
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (response.data.errors) {
            console.error("Ошибки в ответе сервера:", response.data.errors);
            throw new Error("Ошибка в GraphQL-запросе");
        }
        return response.data?.data?.doctorFindPatientPrivateSurveyTemplates;
    }
    catch (error) {
        console.error("Ошибка при выполнении запроса:", error);
        throw error;
    }
};
exports.fetchPatientSurveys = fetchPatientSurveys;
const fetchOneSurveyAnswers = async (patientId, surveyTemplateId, token) => {
    try {
        const response = await axios_1.default.post(env_1.GRAPHQL_ENDPOINT, {
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
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (response.data.errors) {
            console.error("Ошибки в ответе сервера:", response.data.errors);
            throw new Error("Ошибка в GraphQL-запросе");
        }
        return response.data?.data?.doctorFindPatientSurveyAnswers;
    }
    catch (error) {
        console.error("Ошибка при выполнении запроса:", error);
        throw error;
    }
};
exports.fetchOneSurveyAnswers = fetchOneSurveyAnswers;
const fetchDrugs = async (token) => {
    try {
        const response = await axios_1.default.post(env_1.GRAPHQL_ENDPOINT, {
            query: `query GetDrugsFromDB($filter: String) {
          drugsSearch(filter: $filter) {
            id
            name
            __typename
          }
        }
        `,
            variables: {},
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (response.data.errors) {
            console.error("Ошибки в ответе сервера:", response.data.errors);
            throw new Error("Ошибка в GraphQL-запросе");
        }
        const res = response.data?.data?.drugsSearch;
        // ХАРДКОД УБРАТЬ!
        const filtered = res.filter((item) => item.name?.indexOf("Космето") >= 0);
        return res;
    }
    catch (error) {
        console.error("Ошибка при выполнении запроса:", error);
        throw error;
    }
};
exports.fetchDrugs = fetchDrugs;
const fetchQuestionsByDrug = async (token, id) => {
    try {
        const response = await axios_1.default.post(env_1.GRAPHQL_ENDPOINT, {
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
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (response.data.errors) {
            console.error("Ошибки в ответе сервера:", response.data.errors);
            throw new Error("Ошибка в GraphQL-запросе");
        }
        return response.data?.data?.drugFindQuestions;
    }
    catch (error) {
        console.error("Ошибка при выполнении запроса:", error);
        throw error;
    }
};
exports.fetchQuestionsByDrug = fetchQuestionsByDrug;
const sendSurveyToPatient = async (token, input) => {
    try {
        const response = await axios_1.default.post(env_1.GRAPHQL_ENDPOINT, {
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
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (response.data.errors) {
            console.error("Ошибки в ответе сервера:", response.data.errors);
            throw new Error("Ошибка в GraphQL-запросе");
        }
        const surveyTemplate = response.data.data.doctorCreatePrivateSurveyTemplate.surveyTemplate;
        if (surveyTemplate) {
            return { success: true, surveyTemplate: surveyTemplate };
        }
        else {
            return { success: false, error: "Не удалось создать шаблон опроса." };
        }
    }
    catch (error) {
        console.error("Ошибка при выполнении запроса:", error);
        throw error;
    }
};
exports.sendSurveyToPatient = sendSurveyToPatient;
const invitePatient = async (token, input) => {
    try {
        const response = await axios_1.default.post(env_1.GRAPHQL_ENDPOINT, {
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
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        if (response.data.errors) {
            console.error("Ошибки в ответе сервера:", response.data.errors);
            throw new Error(response.data?.errors[0]?.message);
        }
        return response.data;
    }
    catch (error) {
        console.error("Ошибка при выполнении запроса:", error);
        throw error;
    }
};
exports.invitePatient = invitePatient;
const myActiveSurveys = async (token) => {
    try {
        const response = await axios_1.default.post(env_1.GRAPHQL_ENDPOINT, {
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
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        console.log(response.data);
        console.log(response.data?.data?.patientFindActiveSurvey?.template);
        return response.data?.data?.patientFindActiveSurvey;
    }
    catch (error) {
        console.log(error);
        console.error("Ошибка при выполнении запроса:", error);
        throw error;
    }
};
exports.myActiveSurveys = myActiveSurveys;
const sendSurveyAnswers = async (token, input) => {
    try {
        console.log("Отправка запроса на сервер:", JSON.stringify(input, null, 2));
        const response = await axios_1.default.post(env_1.GRAPHQL_ENDPOINT, {
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
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        console.log("Ответ сервера:", JSON.stringify(response.data, null, 2));
        if (response.data.errors) {
            throw new Error(response.data.errors[0].message);
        }
        return response;
    }
    catch (error) {
        console.error("Ошибка при выполнении запроса:", error.message);
        if (error.response) {
            console.error("Ответ сервера:", JSON.stringify(error.response.data, null, 2));
            throw new Error(error.response.data.errors?.[0]?.message || error.message);
        }
        else {
            throw new Error(error.message);
        }
    }
};
exports.sendSurveyAnswers = sendSurveyAnswers;
const contactMeRequest = async (token, doctorId, message) => {
    try {
        const response = await axios_1.default.post(env_1.GRAPHQL_ENDPOINT, {
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
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data?.data?.patientSendContactMeRequest;
    }
    catch (error) {
        console.log(error);
        console.error("Ошибка при выполнении запроса:", error);
        throw error;
    }
};
exports.contactMeRequest = contactMeRequest;
const getMyDoc = async (token) => {
    try {
        const response = await axios_1.default.post(env_1.GRAPHQL_ENDPOINT, {
            query: `query MyDoc {
          patientDoctors {
            doctorId
            id
            patientId
          }
        }
        `,
            variables: {},
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        return response.data?.data?.patientDoctors;
    }
    catch (error) {
        console.log(error);
        console.error("Ошибка при выполнении запроса:", error);
        throw error;
    }
};
exports.getMyDoc = getMyDoc;
