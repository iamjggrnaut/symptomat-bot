import TelegramBot from "node-telegram-bot-api";
import { TELEGRAM_BOT_TOKEN } from "../config/env";
import { handleSelectRole } from "./handlers/auth.handler";
import { userSessions } from "./handlers/auth.handler";
import {
  assignPatientToDoctor,
  contactMeRequest,
  fetchAllQuestionAnswers,
  fetchDoctorNotifications,
  fetchDrugs,
  fetchOneSurveyAnswers,
  fetchPatientNotifications,
  fetchPatientSurveys,
  fetchQuestionsByDrug,
  findPatientByEmail,
  getMyDoc,
  getQuestionAnswers,
  loginDoctor,
  loginPatient,
  myActiveSurveys,
  searchPatients,
  sendSurveyAnswers,
  sendSurveyToPatient,
  signUpDoctor,
  signUpPatient,
} from "../utils/api.util";
import {
  Drug,
  GetQuestionAnswersVariables,
  QuestionsData,
  SurveyInput,
  SurveyStep,
} from "../utils/types";

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN as string, { polling: true });


// Логирование всех событий
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

bot.on('webhook_error', (error) => {
  console.error('Webhook error:', error);
});

bot.on('message', (msg) => {
  console.log('Received message:', msg);
});



const doctorMenu = {
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "Список пациентов",
          callback_data: "list_of_patients",
        },
      ],
      [
        {
          text: "Найти пациента по email",
          callback_data: "find_patient",
        },
      ],
      [
        {
          text: "Новые уведомления",
          callback_data: "my_notifications",
        },
        {
          text: "Все уведомления",
          callback_data: "old_notifications",
        },
      ],
    ],
  },
}

const patientMenu = {
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "Связаться с доктором",
          callback_data: "contact_doctor",
        },
      ],
      [
        {
          text: "Новые уведомления",
          callback_data: "notifications_patient",
        },
      ],
      [
        {
          text: "Активные опросы",
          callback_data: "my_active_surveys",
        },
      ],
    ],
  },
}

export const surveyDataMap = new Map();
export const questionsMap = new Map<number, QuestionsData>();
export const drugsMap = new Map<string, Drug>();
export const patientRequest = new Map<number, string>();
export const doctorId = new Map<number, string>();
export const currentPatients = new Map<number, any>();
export const surveyAnswers = new Map<
  number,
  {
    surveyId: string;
    questions: any[];
    answers: any[];
  }
>();
export const activeSurvey = new Map<number, any>();

const currentQuestion = new Map<number, number>();

const userState = new Map<number, SurveyStep>();

const createSurveyData = new Map<number, SurveyInput>();

const generateKey = () => Math.random().toString(36).substring(2, 10);

const getQuestionTitle = async (questionId: string): Promise<string> => {
  for (const drug of drugsMap.values()) {
    const question = drug.questions.find((q: any) => q.id === questionId);
    if (question) {
      return question.title;
    }
  }
  return "Без названия";
};

let currentPage = 0;
const drugsPerPage = 40;

const showDrugsPage = async (chatId: string, page: number) => {
  const drugs = Array.from(drugsMap.values());

  const startIndex = page * drugsPerPage;
  const endIndex = startIndex + drugsPerPage;
  const drugsPage = drugs.slice(startIndex, endIndex);

  const drugButtons = drugsPage.map((drug) => [
    {
      text: drug.name,
      callback_data: `select_drug_${drug.id}`,
    },
  ]);

  const paginationButtons = [];
  if (page > 0) {
    paginationButtons.push({
      text: "⬅️ Назад",
      callback_data: `drugs_page_${page - 1}`,
    });
  }
  if (endIndex < drugs.length) {
    paginationButtons.push({
      text: "Вперед ➡️",
      callback_data: `drugs_page_${page + 1}`,
    });
  }

  await bot.sendMessage(chatId, "Выберите шаблон:", {
    reply_markup: {
      // inline_keyboard: [
      //   ...drugButtons,
      //   [
      //     {
      //       text: "Вернуться к выбору пациента",
      //       callback_data: "list_of_patients",
      //     },
      //   ],
      // ],
      inline_keyboard: [...drugButtons, paginationButtons, 
        [
          {
            text: "Список пациентов",
            callback_data: "list_of_patients",
          },
        ],
        [
          {
            text: "Найти пациента по email",
            callback_data: "find_patient",
          },
        ],
        [
          {
            text: "Новые уведомления",
            callback_data: "my_notifications",
          },
          {
            text: "Все уведомления",
            callback_data: "old_notifications",
          },
        ],
      ],
    },
  });
};

async function askQuestion(
  chatId: number,
  questions: any[],
  questionIndex: number
) {

  currentQuestion.set(chatId, questionIndex);
  
  const question = questions[questionIndex]?.question;

  if (!question) {
    await bot.sendMessage(chatId, "Ошибка: вопрос не найден.");
    return;
  }

  switch (question.type) {
    case "RADIO":
    case "CHECKBOX":
      const options = question.options?.map((option: any) => [
        {
          text: option.text,
          callback_data: `answer_${questionIndex}_${option.id}`,
        },
      ]);

      if (!options || options.length === 0) {
        await bot.sendMessage(chatId, "Ошибка: нет вариантов ответа.");
        return;
      }

      await bot.sendMessage(chatId, String(question.title), {
        reply_markup: {
          inline_keyboard: options,
        },
      });
      break;

    case "NUMERIC":
    case "SCALE":
    case "TEMPERATURE":
    case "WEIGHT":
    case "PULSE":
      await bot.sendMessage(
        chatId,
        `${question.title}\n\nПожалуйста, введите числовое значение:`
      );
      break;

    case "PRESSURE":
      await bot.sendMessage(
        chatId,
        `${question.title}\n\nПожалуйста, введите давление в формате "120/80":`
      );
      break;

    default:
      await bot.sendMessage(chatId, "Ошибка: неизвестный тип вопроса.");
      break;
  }
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Проверяем, что пользователь в процессе опроса
  const userSurvey = surveyAnswers.get(chatId);
  if (!userSurvey || !userSurvey.questions) return;

  // Получаем текущий вопрос
  const currentQIndex = currentQuestion.get(chatId);
  if (currentQIndex === undefined) return;
  
  const question = userSurvey.questions[currentQIndex]?.question;
  if (!question) return;

  // Обработка в зависимости от типа вопроса
  switch (question.type) {
    case "NUMERIC":
    case "SCALE":
    case "TEMPERATURE":
    case "WEIGHT":
    case "PULSE":
      const numericValue = parseFloat(text as string);
      if (isNaN(numericValue)) {
        await bot.sendMessage(
          chatId,
          "Пожалуйста, введите корректное числовое значение."
        );
        return;
      }

      userSurvey.answers.push({
        questionId: question.id,
        questionType: question.type,
        answerValue: {
          numeric: { value: numericValue },
        },
      });
      break;

    case "PRESSURE":
      // Улучшенная проверка формата давления
      if (!text || !text.includes("/")) {
        await bot.sendMessage(
          chatId,
          "Пожалуйста, введите давление в формате '120/80' (например: 120/80)."
        );
        return;
      }

      const parts = text.split("/");
      if (parts.length !== 2) {
        await bot.sendMessage(
          chatId,
          "Неверный формат. Пожалуйста, введите давление в формате '120/80'."
        );
        return;
      }

      const lowerValue = parseInt(parts[0], 10);
      const upperValue = parseInt(parts[1], 10);

      if (isNaN(lowerValue) || isNaN(upperValue)) {
        await bot.sendMessage(
          chatId,
          "Пожалуйста, введите числовые значения для давления (например: 120/80)."
        );
        return;
      }

      userSurvey.answers.push({
        questionId: question.id,
        questionType: question.type,
        answerValue: {
          pressure: { lowerValue, upperValue },
        },
      });
      break;

    default:
      await bot.sendMessage(chatId, "Неизвестный тип вопроса.");
      return;
  }

  // Переход к следующему вопросу или завершение опроса
  if (currentQIndex + 1 < userSurvey.questions.length) {
    await askQuestion(chatId, userSurvey.questions, currentQIndex + 1);
  } else {
    await completeSurvey(chatId, userSurvey);
  }
});

async function completeSurvey(
  chatId: number,
  userSurvey: { surveyId: string; answers: any[] }
) {
  const token = userSessions.get(chatId);

  console.log('Complete survey - survey: ', JSON.stringify(userSurvey));
  

  try {
    console.log(
      "Отправка ответов на сервер:",
      JSON.stringify(userSurvey, null, 2)
    );

    const response = await sendSurveyAnswers(token as string, {
      surveyId: userSurvey.surveyId,
      answers: userSurvey.answers,
    });

    console.log("Ответ сервера:", JSON.stringify(response, null, 2));

    if (response.data?.data?.patientCompleteSurvey?.success) {
      await bot.sendMessage(
        chatId,
        "Опрос успешно завершен. Спасибо за участие!",
        patientMenu
      );
    } else {
      const errorMessage =
        response.data?.data?.patientCompleteSurvey?.problem?.message ||
        response.data?.errors?.[0]?.message ||
        "Произошла ошибка при отправке ответов.";
      await bot.sendMessage(chatId, errorMessage, patientMenu);
    }
  } catch (error: any) {
    console.error("Ошибка при отправке ответов:", error.message);
    await bot.sendMessage(
      chatId,
      "Опрос успешно завершен. Спасибо за участие!"
    );
  } finally {
    surveyAnswers.delete(chatId);
  }
}

const fetchDrugsAndQuestions = async (token: string) => {
  const drugs = await fetchDrugs(token);

  for (const drug of drugs) {
    const questions = await fetchQuestionsByDrug(token, drug.id);
    drugsMap.set(drug.id, { ...drug, questions });
  }
};

bot.onText(/\/start/, async(msg) => {
  await bot.sendMessage(
    msg.chat.id,
    "Добро пожаловать в Symptomat!",
    {
      reply_markup: {
        inline_keyboard: [
          [{
            text: 'Зарегистрироваться',
            callback_data: 'register'
          }],
          [{
            text: 'Войти',
            callback_data: 'login'
          }],
        ]
      }
    }
  );
});

bot.on('callback_query', async (callbackQuery: any) => {
  
  const data = callbackQuery.data
  const chatId = callbackQuery.message?.chat.id;

  if(data === 'login'){
    const msg = callbackQuery.message
    handleSelectRole(bot, msg);
  } else if( data === 'register'){
    await bot.sendMessage(chatId, 'Выберите роль для регистрации', {
      reply_markup: {
        inline_keyboard: [
          [{
            text: 'Пациент',
            callback_data: 'signup-patient'
          }],
          [{
            text: 'Доктор',
            callback_data: 'signup-doctor'
          }],
        ]
      }
    })
  }
});

bot.on("callback_query", async (callbackQuery: any) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data === 'signup-patient') {
    await bot.sendMessage(chatId, "Введите Ваш email");

    bot.once("message", async (emailMsg) => {
      const email = emailMsg.text;

      if(email){
        await bot.sendMessage(chatId, "Введите пароль");

        bot.once("message", async (pass) => {
          const password = pass.text;

          if (password) {
            await bot.sendMessage(chatId, "Введите номер медицинской карты");
    
            bot.once("message", async (cardMsg) => {
              const medicalCardNumber = cardMsg.text;
    
              if (medicalCardNumber) {
                await bot.sendMessage(chatId, "Ваше имя");
    
                bot.once("message", async (firstNameMsg) => {
                  const firstname = firstNameMsg.text;
    
                  if (firstname) {
                    await bot.sendMessage(chatId, "Ваша фамилия");
    
                    bot.once("message", async (lastNameMsg) => {
                      const lastname = lastNameMsg.text;
    
                      if (lastname) {
                        
                        try{
                          const response = await signUpPatient(email, firstname, lastname, medicalCardNumber, password, chatId)
                          if (response?.accessToken) {
                            userSessions.set(chatId, response.accessToken);
                          }
                          console.log(response);
                          if(response.status !== 400){
                            
                            await bot.sendMessage(chatId, 'Регистрация успешно пройдена. Добро пожаловать!', patientMenu)
                          } else {
                            await bot.sendMessage(chatId, 'Что-то пошло не так... Попробуйте пройти регистрацию еще раз позже.')
                          }
                        }catch(error){
                          await bot.sendMessage(chatId, 'Пользователь с таким email уже существует! Попробуйте снова и используйте другой email.',  {
                            reply_markup: {
                              inline_keyboard: [
                                [{
                                  text: 'Пациент',
                                  callback_data: 'signup-patient'
                                }],
                                [{
                                  text: 'Доктор',
                                  callback_data: 'signup-doctor'
                                }],
                              ]
                            }
                          })
                        }
                      }
                    })
                  }
                })
              }
            })
          }
        })
      }
    })
  } else if(data === 'signup-doctor'){
    await bot.sendMessage(chatId, "Введите Ваш email");

    bot.once("message", async (emailMsg) => {
      const email = emailMsg.text;

      if (email) {
        await bot.sendMessage(chatId, "Введите пароль");

        bot.once("message", async (cardMsg) => {
          const password = cardMsg.text;

          if (password) {
            try{
              const response = await signUpDoctor(email, password, chatId)

              if (response?.accessToken) {
                userSessions.set(chatId, response.accessToken);
                doctorId.set(chatId, response?.user?.id)
              }
              fetchDrugsAndQuestions(response?.accessToken);
    
              const patients = await searchPatients("", 20, response.accessToken);
  
              
              if(response?.accessToken){
                console.log(response);
                
                await bot.sendMessage(chatId, 'Регистрация успешно пройдена. Добро пожаловать!', doctorMenu)
                if (patients.nodes.length > 0) {
                  console.log("List of patients found");
                } else {
                  console.log(chatId, "У вас пока нет пациентов.");
                }
              } else {
                await bot.sendMessage(chatId, 'Что-то пошло не так... Попробуйте пройти регистрацию еще раз позже.')
              }
            } catch(error){
              await bot.sendMessage(chatId, 'Пользователь с таким email уже существует! Попробуйте снова и используйте другой email.',  {
                reply_markup: {
                  inline_keyboard: [
                    [{
                      text: 'Пациент',
                      callback_data: 'signup-patient'
                    }],
                    [{
                      text: 'Доктор',
                      callback_data: 'signup-doctor'
                    }],
                  ]
                }
              })
            }
          }
        })
      }
    })
  }
});

bot.on("callback_query", async (callbackQuery: any) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data.startsWith("drugs_page_")) {
    const page = parseInt(data.split("_")[2], 10);
    await showDrugsPage(chatId, page);
  }
});

// SELECT DRUG
bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data.startsWith("select_drug_")) {
    const drugId = data.split("_")[2];

    const drug = drugsMap.get(drugId);

    if (drug && drug.questions.length > 0) {
      const csdQuestions = drug.questions.map((item) => ({
        questionId: item.id,
        questionType: item.type,
        criticalIndicators: null,
      }));

      const questionsData = questionsMap.get(chatId);
      const patientId = questionsData?.patientId;

      createSurveyData.set(chatId, {
        title: drug.name,
        drugsIds: [drugId],
        patientId: patientId as string,
        period: "",
        questions: csdQuestions,
        startAt: "",
        endAt: "",
        timezoneOffset: -180,
      });

      userState.set(chatId, SurveyStep.START_DATE);

      await bot.sendMessage(
        chatId,
        "Определите начало периода. Введите число, месяц и год через точку. Пример: 22.02.2025"
      );
    } else {
      await bot.sendMessage(chatId, "Вопросы не найдены.");
    }
  }
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const state = userState.get(chatId);

  if (!text || !state) return;

  if (state === SurveyStep.START_DATE || state === SurveyStep.END_DATE) {
    const input = createSurveyData.get(chatId);
    if (!input) return;

    switch (state) {
      case SurveyStep.START_DATE: {
        const values = text.split(".");
        if (values.length === 3) {
          const [day, month, year] = values;
          const startAt = new Date(`${year}-${month}-${day}`);

          if (isNaN(startAt.getTime())) {
            await bot.sendMessage(
              chatId,
              "Некорректная дата. Попробуйте снова."
            );
            return;
          }

          createSurveyData.set(chatId, {
            ...input,
            startAt: startAt.toISOString(),
          });

          userState.set(chatId, SurveyStep.END_DATE);

          await bot.sendMessage(
            chatId,
            "Определите окончание периода. Введите число, месяц и год через точку. Пример: 22.02.2025"
          );
        } else {
          await bot.sendMessage(
            chatId,
            "Некорректный формат даты. Попробуйте снова."
          );
        }
        break;
      }

      case SurveyStep.END_DATE: {
        const values = text.split(".");
        if (values.length === 3) {
          const [day, month, year] = values;
          const endAt = new Date(`${year}-${month}-${day}`);

          if (isNaN(endAt.getTime())) {
            await bot.sendMessage(
              chatId,
              "Некорректная дата. Попробуйте снова."
            );
            return;
          }

          createSurveyData.set(chatId, {
            ...input,
            endAt: endAt.toISOString(),
          });

          userState.set(chatId, SurveyStep.PERIOD);

          await bot.sendMessage(chatId, "Выберите периодичность", {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "Каждый день",
                    callback_data: "period-EVERYDAY",
                  },
                ],
                [
                  {
                    text: "Каждые два дня",
                    callback_data: "period-EVERY_TWO_DAYS",
                  },
                ],
                [
                  {
                    text: "Раз в неделю",
                    callback_data: "period-ONCE_A_WEEK",
                  },
                ],
                [
                  {
                    text: "Раз в две недели",
                    callback_data: "period-ONCE_IN_TWO_WEEKS",
                  },
                ],
              ],
            },
          });
        } else {
          await bot.sendMessage(
            chatId,
            "Некорректный формат даты. Попробуйте снова."
          );
        }
        break;
      }

      default:
        break;
    }
  } else {
    const userSurvey = surveyAnswers.get(chatId);
    if (
      !userSurvey ||
      !userSurvey.questions ||
      !Array.isArray(userSurvey.questions)
    )
      return;

    const currentQuestionIndex = userSurvey.answers.length;
    const question = userSurvey.questions[currentQuestionIndex]?.question;
    if (!question) return;

    switch (question.type) {
      case "NUMERIC":
      case "SCALE":
      case "TEMPERATURE":
      case "WEIGHT":
      case "PULSE":
        const numericValue = parseFloat(text);
        if (isNaN(numericValue)) {
          await bot.sendMessage(
            chatId,
            "Пожалуйста, введите корректное числовое значение."
          );
          return;
        }

        userSurvey.answers.push({
          questionId: question.id,
          questionType: question.type,
          answerValue: {
            numeric: { value: numericValue }, // Для NUMERIC, SCALE, TEMPERATURE, WEIGHT, PULSE
          },
        });
        break;

      case "PRESSURE":
        const [lowerValue, upperValue] = text.split("/").map(Number);
        if (isNaN(lowerValue) || isNaN(upperValue)) {
          await bot.sendMessage(
            chatId,
            "Пожалуйста, введите давление в формате '120/80'."
          );
          return;
        }

        userSurvey.answers.push({
          questionId: question.id,
          questionType: question.type,
          answerValue: {
            pressure: { lowerValue, upperValue }, // Для PRESSURE
          },
        });
        break;

      default:
        await bot.sendMessage(chatId, "Неизвестный тип вопроса.");
        return;
    }

    if (currentQuestionIndex + 1 < userSurvey.questions.length) {
      await askQuestion(chatId, userSurvey.questions, currentQuestionIndex + 1);
    } else {
      await completeSurvey(chatId, userSurvey);
    }
  }
});

bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data.startsWith("period-")) {
    const period = data.split("-")[1];

    const input = createSurveyData.get(chatId);
    if (!input) return;

    createSurveyData.set(chatId, {
      ...input,
      period,
    });

    userState.set(chatId, SurveyStep.COMPLETE);

    await bot.sendMessage(
      chatId,
      "Опросник успешно создан. Отправить пациенту?",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Отправить",
                callback_data: "send_survey",
              },
            ],
          ],
        },
      }
    );
  }
});

// SEND SURVEY
bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data === "send_survey") {
    const questionsData = questionsMap.get(chatId);
    const patientId = questionsData?.patientId;

    if (!questionsData || !patientId) {
      await bot.sendMessage(
        chatId,
        "Ошибка: данные для отправки опроса не найдены."
      );
      return;
    }

    const input = createSurveyData.get(chatId);

    const token = userSessions.get(chatId);

    try {
      const response = await sendSurveyToPatient(
        token as string,
        input as SurveyInput
      );

      if (response.success) {
        await bot.sendMessage(chatId, "Опрос успешно отправлен пациенту.", doctorMenu);
      } else {
        await bot.sendMessage(chatId, "Произошла ошибка при отправке опроса.");
      }
    } catch (error: any) {
      await bot.sendMessage(chatId, `${error.message}`);
    }
  }
});

// BACK TO MENU
bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data === "back_to_main_menu") {
    await bot.sendMessage(chatId, "Выберите действие:", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Посмотреть ответы на опросы",
              callback_data: "action_surveys",
            },
            {
              text: "Создать и отправить опрос",
              callback_data: "action_create_survey",
            },
          ],
        ],
      },
    });
  }
});

bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data === "role_doctor") {
    await bot.sendMessage(chatId, "Введите ваш email:");

    bot.once("message", async (emailMsg) => {
      const email = emailMsg.text;

      if (!email) {
        await bot.sendMessage(
          chatId,
          "Email не может быть пустым. Попробуйте снова."
        );
        return;
      }

      await bot.sendMessage(chatId, "Введите ваш пароль:");

      bot.once("message", async (passwordMsg) => {
        const password = passwordMsg.text;

        if (!password) {
          await bot.sendMessage(
            chatId,
            "Пароль не может быть пустым. Попробуйте снова."
          );
          return;
        }

        try {
          const doctorResponse = await loginDoctor(email, password);       

          if (doctorResponse?.accessToken) {
            userSessions.set(chatId, doctorResponse.accessToken);
            doctorId.set(chatId, doctorResponse?.user?.id)
          }

          if (doctorResponse?.accessToken) {
            await bot.sendMessage(
              chatId,
              "Вы успешно авторизованы как доктор!"
            );

            fetchDrugsAndQuestions(doctorResponse?.accessToken);

            const patients = await searchPatients("", 20, doctorResponse.accessToken);

            await bot.sendMessage(chatId, "Что Вас интересует?", doctorMenu);

            if (patients.nodes.length > 0) {
              console.log("List of patients found");
            } else {
              console.log("List of patients тще found");
            }
          } else {
            await bot.sendMessage(
              chatId,
              "Ошибка авторизации. Проверьте email и пароль."
            );
          }
        } catch (error) {
          await bot.sendMessage(chatId, "Произошла ошибка. Попробуйте снова.");
        }
      });
    });
  } else if (data === "role_patient") {
    await bot.sendMessage(chatId, "Введите ваш email:");

    bot.once("message", async (emailMsg) => {
      const email = emailMsg.text;

      if (!email) {
        await bot.sendMessage(
          chatId,
          "Email не может быть пустым. Попробуйте снова."
        );
        return;
      }
      await bot.sendMessage(chatId, "Введите ваш пароль:");

      bot.once("message", async (passwordMsg) => {
        const password = passwordMsg.text;

        if (!password) {
          await bot.sendMessage(
            chatId,
            "Пароль не может быть пустым. Попробуйте снова."
          );
          return;
        }

        try {
          const patientResponse = await loginPatient(email, password);

          if (patientResponse?.accessToken) {
            userSessions.set(chatId, patientResponse.accessToken);
          }

          if (patientResponse?.accessToken) {
            await bot.sendMessage(
              chatId,
              "Вы успешно авторизованы как пациент!",
              {
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "Связаться с доктором",
                        callback_data: "contact_doctor",
                      },
                    ],
                    [
                      {
                        text: "Новые уведомления",
                        callback_data: "notifications_patient",
                      },
                    ],
                    [
                      {
                        text: "Активные опросы",
                        callback_data: "my_active_surveys",
                      },
                    ],
                  ],
                },
              }
            );
          } else {
            await bot.sendMessage(
              chatId,
              "Ошибка авторизации. Проверьте email и пароль."
            );
          }
        } catch (error) {
          await bot.sendMessage(chatId, "Произошла ошибка. Попробуйте снова.");
        }
      });
    });
  }
});

bot.on("callback_query", async (callbackQuery: any) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data.startsWith("my_active_surveys")) {
    const token = userSessions.get(chatId);

    try {
      const survey = await myActiveSurveys(token as string);

      if (
        survey &&
        survey.template?.questions &&
        Array.isArray(survey.template.questions)
      ) {
        activeSurvey.set(chatId, survey);

        surveyAnswers.set(chatId, {
          surveyId: survey.id,
          questions: survey.template.questions,
          answers: [],
        });

        await bot.sendMessage(chatId, "Активный опрос: ", {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: survey?.template?.title,
                  callback_data: "selectsurvey",
                },
              ],
            ],
          },
        });
      } else {
        await bot.sendMessage(chatId, "Активных опросов не найдено.");
      }
    } catch (error) {
      console.log(error);
      await bot.sendMessage(chatId, "Произошла ошибка при получении опроса.");
    }
  }
});

bot.on("callback_query", async (callbackQuery: any) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data || !data.startsWith("selectsurvey")) return;

  const survey = activeSurvey.get(chatId);

  try {
    if (!survey) {
      await bot.sendMessage(
        chatId,
        "Произошла ошибка. Попробуйте еще раз позже."
      );
    } else {
      await askQuestion(chatId, survey.template.questions, 0);
    }
  } catch (error) {
    console.log(error);
  }
});

bot.on("callback_query", async (callbackQuery: any) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  // Обработка ответов на RADIO и CHECKBOX
  if (data.startsWith("answer_")) {
    const [, questionIndexStr, answerId] = data.split("_");
    const questionIndex = parseInt(questionIndexStr, 10);

    const userSurvey = surveyAnswers.get(chatId);
    if (
      !userSurvey ||
      !userSurvey.questions ||
      !Array.isArray(userSurvey.questions)
    )
      return;

    const question = userSurvey.questions[questionIndex]?.question;
    if (!question) return;

    // Сохраняем ответ
    if (question.type === "RADIO") {
      userSurvey.answers.push({
        questionId: question.id,
        questionType: question.type,
        answerQuestionOptionId: answerId, // Для RADIO
      });
    } else if (question.type === "CHECKBOX") {
      const existingAnswer = userSurvey.answers.find(
        (ans) => ans.questionId === question.id
      );
      if (existingAnswer) {
        existingAnswer.answerQuestionOptionsIds.push(answerId);
      } else {
        userSurvey.answers.push({
          questionId: question.id,
          questionType: question.type,
          answerQuestionOptionsIds: [answerId], // Для CHECKBOX
        });
      }
    }

    if (questionIndex + 1 < userSurvey.questions.length) {
      await askQuestion(chatId, userSurvey.questions, questionIndex + 1);
    } else {
      await completeSurvey(chatId, userSurvey);
    }
  }
});

bot.on("callback_query", async (callbackQuery: any) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data.startsWith("patient_")) {
    const patientId = data.split("_")[1];

    questionsMap.set(chatId, { patientId: patientId, selectedQuestions: [] });

    await bot.sendMessage(chatId, "Выберите действие:", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Посмотреть пройденные опросы",
              callback_data: `action_surveys_${patientId}`,
            },
          ],
          [
            {
              text: "Создать и отправить опрос",
              callback_data: `action_create_survey_${patientId}`,
            },
          ],
        ],
      },
    });
  }
});

bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data.startsWith("action_surveys_")) {
    const patientId = data.split("_")[2]?.trim();
    const token = userSessions.get(chatId);

    try {
      let surveys = await fetchPatientSurveys(patientId, null, token as string);

      if (surveys) {
        const surveyButtons = surveys.map((survey: any) => {
          const key = generateKey();
          surveyDataMap.set(key, {
            patientId,
            templateId: survey.id,
            title: survey.title,
            survey: survey,
          });

          return [
            {
              text: `${survey.title} - создан ${new Date(
                survey.createdAt
              ).toLocaleDateString()}`,
              callback_data: `survey_${key}`,
            },
          ];
        });

        await bot.sendMessage(chatId, `Список опросов:`, {
          reply_markup: {
            inline_keyboard: surveyButtons,
          },
        });
        await bot.sendMessage(chatId, `Меню`, doctorMenu);
      } else {
        await bot.sendMessage(chatId, "Опросы не найдены.");
      }
    } catch (error) {
      console.error("Ошибка при запросе опросов:", error);
      await bot.sendMessage(chatId, "Произошла ошибка при запросе опросов.");
    }
  }
});

bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data.startsWith("survey_")) {
    const token = userSessions.get(chatId);

    const key = data.split("_")[1];
    const { patientId, templateId, title, survey } = surveyDataMap.get(key);

    const patients = currentPatients.get(chatId);

    const currentPatient = patients?.find(
      (pat: any) => pat.patientId === patientId
    );

    if (!patientId || !templateId) {
      await bot.sendMessage(chatId, "Данные не найдены.");
      return;
    }

    let anotherSurvey = await fetchOneSurveyAnswers(
      patientId,
      templateId,
      token as string
    );

    // console.log(JSON.stringify(anotherSurvey));

    const variables: GetQuestionAnswersVariables = {
      patientId: patientId,
      questionId: anotherSurvey[0]?.questionId,
      take: 5,
    };

    getQuestionAnswers(token as string, variables)
      .then((response) => {
        console.log("Ответ сервера:", JSON.stringify(response, null, 2));
      })
      .catch((error) => {
        console.error("Ошибка:", error.message);
      });

    if (anotherSurvey) {
      const allQuestionAnswers = await fetchAllQuestionAnswers(
        patientId,
        token as string,
        anotherSurvey
      );

      // console.log(JSON.stringify(allQuestionAnswers));

      if (allQuestionAnswers) {
        let questionAnswersText = allQuestionAnswers.map((item: any) => `
Вопрос: ${item.questionTitle}
Ответы: 
${item.answers.map((answer: any) => {
  // Для вопросов с вариантами ответов (RADIO, CHECKBOX)
  if (answer.answerQuestionOption) {
    return `${answer.answerQuestionOption.text} ${answer?.createdAt ? new Date(answer?.createdAt).toLocaleDateString("ru") : "Дата неизвестна"}`;
  } 
  // Для вопросов типа PRESSURE
  else if (answer.answerValue?.pressure) {
    return `${answer.answerValue.pressure.lowerValue}/${answer.answerValue.pressure.upperValue} ${answer?.createdAt ? new Date(answer?.createdAt).toLocaleDateString("ru") : "Дата неизвестна"}`;
  }
  // Для других типов вопросов
  else {
    return `Нет данных ${answer?.createdAt ? new Date(answer?.createdAt).toLocaleDateString("ru") : "Дата неизвестна"}`;
  }
}).join("\n")}
---`).join("\n");

        let text = [`${title}\n${currentPatient?.firstName || ""} ${currentPatient?.lastName || ""}\nНомер медицинской карты: ${currentPatient?.medicalCardNumber || ""}`, questionAnswersText,].join("\n");

        await bot.sendMessage(chatId, text ? text : "Нет данных");
      }
    }
  }
});

bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data.startsWith("list_of_patients")) {
    const token = userSessions.get(chatId);

    const patients = await searchPatients("", 20, token as string);

    currentPatients.set(chatId, patients?.nodes);

    if (patients?.nodes.length > 0) {
      const patientButtons = patients?.nodes.map((patient: any) => [
        {
          text: `${patient.firstName} ${patient.lastName}`,
          callback_data: `patient_${patient.patientId}`,
        },
      ]);

      await bot.sendMessage(chatId, "Выберите пациента:", {
        reply_markup: {
          inline_keyboard: patientButtons,
        },
      });
    } else {
      await bot.sendMessage(chatId, "У вас пока нет пациентов.");
    }
  }
});

bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;
  const token = userSessions.get(chatId);

  if (data.startsWith("my_notifications")) {
    if (!token) {
      await bot.sendMessage(
        chatId,
        "Вы не авторизованы. Пожалуйста, авторизуйтесь."
      );
      return;
    }

    const notifications = await fetchDoctorNotifications(
      chatId.toString(),
      20,
      "20",
      token
    );

    const newNotifications = notifications?.nodes?.filter(
      (item: any) => !item.isRead
    );

    if (
      !notifications ||
      notifications?.nodes?.length === 0 ||
      newNotifications?.length === 0
    ) {
      await bot.sendMessage(chatId, "У вас нет новых уведомлений.", doctorMenu);
      return;
    }

    const formattedNotifications = newNotifications
      ?.map((edge: any) => {
        return `📅 ${new Date(edge.createdAt).toLocaleString()}\n📝 ${
          edge.description
        }`;
      })
      .join("\n\n");

    await bot.sendMessage(
      chatId,
      `Ваши новые уведомления:\n\n${formattedNotifications}`,
      doctorMenu
    );
  } else if (data.startsWith("old_notifications")) {
    if (!token) {
      await bot.sendMessage(
        chatId,
        "Вы не авторизованы. Пожалуйста, авторизуйтесь."
      );
      return;
    }

    const notifications = await fetchDoctorNotifications(
      chatId.toString(),
      20,
      "20",
      token
    );

    console.log(notifications);

    if (!notifications || notifications.nodes.length === 0) {
      await bot.sendMessage(chatId, "У вас нет уведомлений.");
      return;
    }

    const formattedNotifications = notifications.nodes
      .map((edge: any) => {
        return `📅 ${new Date(edge.createdAt).toLocaleString()}\n📝 ${
          edge.description
        }`;
      })
      .join("\n\n");

    await bot.sendMessage(
      chatId,
      `Все уведомления:\n\n${formattedNotifications}`,
     doctorMenu
    );
  }
});

bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data.startsWith("notifications_patient")) {
    const token = userSessions.get(chatId);

    const notifications = await fetchPatientNotifications(10, token as string);

    const newNotifications = notifications?.nodes?.filter(
      (item: any) => !item.isRead
    );

    if (
      !notifications ||
      notifications?.nodes?.length === 0 ||
      newNotifications?.length === 0
    ) {
      await bot.sendMessage(chatId, "У вас нет новых уведомлений.", patientMenu);
      return;
    }

    const formattedNotifications = newNotifications
      ?.map((edge: any) => {
        return `📅 ${new Date(edge.createdAt).toLocaleString()}\n📝 ${
          edge.title
        }`;
      })
      .join("\n\n");

    await bot.sendMessage(
      chatId,
      `Ваши новые уведомления:\n\n${formattedNotifications}`,
      patientMenu
    );
  }
});

bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data.startsWith("action_create_survey_")) {
    const token = userSessions.get(chatId);

    await bot.sendMessage(chatId, `Веберите вариант:`, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Выбрать шаблон",
              callback_data: "selectdrug",
            },
          ],
          [
            {
              text: "Поиск препарата",
              callback_data: "searchdrug",
            },
          ],
        ],
      },
    });
  }
});

bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data.startsWith("selectdrug")) {
    const token = userSessions.get(chatId);

    await showDrugsPage(String(chatId), currentPage);
  }
});

bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data.startsWith("searchdrug")) {
    const token = userSessions.get(chatId);

    await bot.sendMessage(chatId, 'Введите первые 5 символов названия препарата')

    bot.once('message', async(msg) => {
      const name = msg.text?.toLocaleLowerCase()?.trim()

      if(name && name.length < 5){
        await bot.sendMessage(chatId, 'Необходимо ввести минимум 5 символов названия препарата', {
          reply_markup:{
            inline_keyboard: [
              [
                {
                  text: "Выбрать шаблон",
                  callback_data: "selectdrug",
                },
              ],
              [
                {
                  text: "Поиск препарата",
                  callback_data: "searchdrug",
                },
              ],
            ]
          }
        }) 
      } else {

        const drugs = await fetchDrugs(token as string);
        if(drugs && drugs.length > 0){
          const filtered = drugs.filter((drug:any) => drug.name?.toLowerCase()?.indexOf(name) >= 0)

          if(filtered?.length > 0){
            await bot.sendMessage(chatId, 'Результат поиска по запросу: ' + name, {
              reply_markup: {
                inline_keyboard: filtered.map((item: any) => [{
                  text: item.name,
                  callback_data: `select_drug_${item.id}`
                }])
              }
            })
          }
        else{
          await bot.sendMessage(chatId, 'Препарат не найден... Оставьте Ваш контактный номер телефона, пожалуйста. Наша поддрежка скоро с Вами свяжется для уточнения деталей и добавит препарат в каталог', {
            reply_markup:{
              keyboard: [
                [{
                  text: 'Поделиться', 
                  request_contact: true,
                }],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
            }
          })
        }
        } else {
          await bot.sendMessage(chatId, 'Не удалось получить список препаратов. Попробуйте позже.', doctorMenu)
        }

      }
    })
    
  }
});

bot.on('contact', (msg: any) => {
  const chatId = msg.chat.id;
  const phoneNumber = msg?.contact?.phone_number; 

  const contactCard = `
Врач оставил номер телефона для связи с ним.
Необходимо добавить препарат в каталог.
Номер телефона врача: ${msg?.contact?.phone_number}
Имя: ${msg?.contact?.first_name || 'не указано'}
Фамилия: ${msg?.contact?.last_name || 'не указана'}
`

  bot.sendMessage('-4615427956', contactCard)
  

  bot.sendMessage(chatId, 'Ваша заявка принята! Ожидайте, пожалуйста, в ближайшее время с Вами свяжется служба поддержки.', doctorMenu);

});

bot.on("callback_query", async (callbackQuery: any) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  const token = userSessions.get(chatId);

  if (data.startsWith("contact_")) {
    await bot.sendMessage(chatId, "Введите Ваше сообщение: ");

    const myDoc = await getMyDoc(token as string);

    if (myDoc && myDoc.length > 0) {
      try {
        doctorId.set(chatId, myDoc[0]?.doctorId);

        bot.once("message", async (message) => {
          const text = message.text;

          patientRequest.set(chatId, text as string);

          if (text) {
            await bot.sendMessage(chatId, "Отправить запрос?", {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Отправить",
                      callback_data: "send_request",
                    },
                  ],
                ],
              },
            });
          }
        });
      } catch (error) {
        console.log(error);
        throw error;
      }
    }
  }
});

bot.on("callback_query", async (callbackQuery: any) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data.startsWith("send_request")) {
    const token = userSessions.get(chatId);

    const message = patientRequest.get(chatId);

    const docId = doctorId.get(chatId);

    try {
      await contactMeRequest(
        token as string,
        docId as string,
        message as string
      );

      await bot.sendMessage(chatId, "Запрос успешно отправлен!", patientMenu);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
});

bot.on("callback_query", async (callbackQuery: any) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data.startsWith("change_patient")) {
    const token = userSessions.get(chatId);

    const message = patientRequest.get(chatId);

    const docId = doctorId.get(chatId);

    try {
      await contactMeRequest(
        token as string,
        docId as string,
        message as string
      );

      await bot.sendMessage(chatId, "Запрос успешно отправлен!");
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
});

bot.on("callback_query", async (callbackQuery: any) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data === "find_patient") {
    const token = userSessions.get(chatId);

    await bot.sendMessage(chatId, 'Введите email пациента')
    

    bot.once("message", async (emailMsg) => {
      const email = emailMsg.text

      if(email){
        try {
          const targetPatient = await findPatientByEmail(
            email as string,
            token as string,
          );
          
          if(targetPatient){            

            await bot.sendMessage(chatId, `
Пациент найден!\n
${targetPatient.firstName}
${targetPatient.lastName}
Номер медицинской карты: ${targetPatient.medicalCardNumber}
              `, {
              reply_markup: {
                inline_keyboard: [
                  [{
                    text: 'Закрепить пациента за собой',
                    callback_data: `assign_patient:${targetPatient.patientId}`
                  }],
                ]
              }
            });
          }
          else {
            await bot.sendMessage(chatId, 'Возникла ошибка', doctorMenu)
          }
        } catch (error) {
          console.log(error);
          await bot.sendMessage(chatId, 'Пациет не найден', doctorMenu)
        }
      }
    })
    

  }
});

bot.on("callback_query", async (callbackQuery: any) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data.startsWith("assign_patient:")) {
    const token = userSessions.get(chatId);
    const patientId = data.split(':')[1]

    const docId = doctorId.get(chatId)

    console.log('docId ', docId);
    console.log('patientId ', patientId);
    

    try{
      const response = await assignPatientToDoctor(patientId, docId as string, token as string)
      console.log(response);
      
      if(response){
        await bot.sendMessage(chatId, 'Пациент успешно закрелен за Вами!', doctorMenu)
      } else {
        await bot.sendMessage(chatId, 'Произошла ошибка. Попробуйте еще раз позже или обратитесь в службу поддержки.')
      }
    } catch(error){
      console.log(error);
    }

    
    
  }
});

// bot.on("callback_query", async (callbackQuery) => {
//   const chatId = callbackQuery.message?.chat.id;
//   const data = callbackQuery.data;

//   if (!chatId || !data) return;

//   if (data.startsWith("add_patient")) {
//     const token = userSessions.get(chatId);

//     await bot.sendMessage(chatId, "Введите email для отправки приглашения");

//     bot.once("message", async (emailMsg) => {
//       const email = emailMsg.text;

//       if (email) {
//         await bot.sendMessage(chatId, "Введите номер медицинской карты");

//         bot.once("message", async (cardMsg) => {
//           const medicalCardNumber = cardMsg.text;

//           if (medicalCardNumber) {
//             await bot.sendMessage(chatId, "Введите имя пациента");

//             bot.once("message", async (firstNameMsg) => {
//               const firstname = firstNameMsg.text;

//               if (firstname) {
//                 await bot.sendMessage(chatId, "Введите фамилию пациента");

//                 bot.once("message", async (lastNameMsg) => {
//                   const lastname = lastNameMsg.text;

//                   if (lastname) {
//                     try {
//                       const response = await invitePatient(token as string, {
//                         medicalCardNumber,
//                         email,
//                         firstname,
//                         lastname,
//                       });

//                       if (response.status !== 400) {
//                         await bot.sendMessage(
//                           chatId,
//                           "Приглашение успешно отправлено",
//                           {
//                             reply_markup: {
//                               inline_keyboard: [
//                                 [
//                                   {
//                                     text: "Список пациентов",
//                                     callback_data: "list_of_patients",
//                                   },
//                                 ],
//                                 [
//                                   {
//                                     text: "Пригласить пациента",
//                                     callback_data: "add_patient",
//                                   },
//                                 ],
//                                 [
//                                   {
//                                     text: "Новые уведомления",
//                                     callback_data: "my_notifications",
//                                   },
//                                   {
//                                     text: "Все уведомления",
//                                     callback_data: "old_notifications",
//                                   },
//                                 ],
//                               ],
//                             },
//                           }
//                         );
//                       }
//                     } catch (error: any) {
//                       await bot.sendMessage(
//                         chatId,
//                         `Пользователь с таким email уже существует.`,
//                         {
//                           reply_markup: {
//                             inline_keyboard: [
//                               [
//                                 {
//                                   text: "Список пациентов",
//                                   callback_data: "list_of_patients",
//                                 },
//                               ],
//                               [
//                                 {
//                                   text: "Пригласить пациента",
//                                   callback_data: "add_patient",
//                                 },
//                               ],
//                               [
//                                 {
//                                   text: "Новые уведомления",
//                                   callback_data: "my_notifications",
//                                 },
//                                 {
//                                   text: "Все уведомления",
//                                   callback_data: "old_notifications",
//                                 },
//                               ],
//                             ],
//                           },
//                         }
//                       );
//                     }
//                   }
//                 });
//               }
//             });
//           }
//         });
//       }
//     });
//   }
// });

console.log("Бот запущен...");
