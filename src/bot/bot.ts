import TelegramBot from "node-telegram-bot-api";
import { TELEGRAM_BOT_TOKEN } from "../config/env";
import { handleSelectRole } from "./handlers/auth.handler";
import { userSessions } from "./handlers/auth.handler";
import {
  contactMeRequest,
  fetchAllQuestionAnswers,
  fetchDoctorNotifications,
  fetchDrugs,
  fetchOneSurveyAnswers,
  fetchPatientNotifications,
  fetchPatientSurveys,
  fetchQuestionsByDrug,
  getMyDoc,
  getQuestionAnswers,
  invitePatient,
  loginDoctor,
  loginPatient,
  myActiveSurveys,
  searchPatients,
  sendSurveyAnswers,
  sendSurveyToPatient,
} from "../utils/api.util";
import {
  Drug,
  GetQuestionAnswersVariables,
  QuestionsData,
  SurveyInput,
  SurveyStep,
} from "../utils/types";

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN as string, { polling: true });

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
const drugsPerPage = 5;

const showDrugsPage = async (chatId: string, page: number) => {
  const drugs = Array.from(drugsMap.values());

  const startIndex = page * drugsPerPage;
  const endIndex = startIndex + drugsPerPage;
  const drugsPage = drugs.slice(startIndex, endIndex);

  const drugButtons = drugs.slice(0, 40).map((drug) => [
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
      inline_keyboard: [
        ...drugButtons,
        [
          {
            text: "Вернуться к выбору пациента",
            callback_data: "list_of_patients",
          },
        ],
      ],
      // inline_keyboard: [...drugButtons, paginationButtons],
    },
  });
};

async function askQuestion(
  chatId: number,
  questions: any[],
  questionIndex: number
) {
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
    case "PRESSURE":
      await bot.sendMessage(
        chatId,
        `${question.title}\n\nПожалуйста, введите числовое значение:`
      );
      break;

    default:
      await bot.sendMessage(chatId, "Ошибка: неизвестный тип вопроса.");
      break;
  }
}

async function completeSurvey(
  chatId: number,
  userSurvey: { surveyId: string; answers: any[] }
) {
  const token = userSessions.get(chatId);

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
      const errorMessage =
        response.data?.data?.patientCompleteSurvey?.problem?.message ||
        response.data?.errors?.[0]?.message ||
        "Произошла ошибка при отправке ответов.";
      await bot.sendMessage(chatId, errorMessage, {
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
      });
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
    await bot.sendMessage(chatId, 'Hello')
    await bot.sendMessage(chatId, "Введите email для отправки приглашения");

    bot.once("message", async (emailMsg) => {
      const email = emailMsg.text;

      if (email) {
        await bot.sendMessage(chatId, "Введите номер медицинской карты");

        bot.once("message", async (cardMsg) => {
          const medicalCardNumber = cardMsg.text;

          if (medicalCardNumber) {
            await bot.sendMessage(chatId, "Введите имя пациента");

            bot.once("message", async (firstNameMsg) => {
              const firstname = firstNameMsg.text;

              if (firstname) {
                await bot.sendMessage(chatId, "Введите фамилию пациента");

                bot.once("message", async (lastNameMsg) => {
                  const lastname = lastNameMsg.text;

                  if (lastname) {

                    const token = ''

                    // try {
                    //   const response = await invitePatient(token as string, {
                    //     medicalCardNumber,
                    //     email,
                    //     firstname,
                    //     lastname,
                    //   });

                    //   if (response.status !== 400) {
                    //     await bot.sendMessage(
                    //       chatId,
                    //       "Приглашение успешно отправлено",
                    //       {
                    //         reply_markup: {
                    //           inline_keyboard: [
                    //             [
                    //               {
                    //                 text: "Список пациентов",
                    //                 callback_data: "list_of_patients",
                    //               },
                    //             ],
                    //             [
                    //               {
                    //                 text: "Пригласить пациента",
                    //                 callback_data: "add_patient",
                    //               },
                    //             ],
                    //             [
                    //               {
                    //                 text: "Новые уведомления",
                    //                 callback_data: "my_notifications",
                    //               },
                    //               {
                    //                 text: "Все уведомления",
                    //                 callback_data: "old_notifications",
                    //               },
                    //             ],
                    //           ],
                    //         },
                    //       }
                    //     );
                    //   }
                    // } catch (error: any) {
                    //   await bot.sendMessage(
                    //     chatId,
                    //     `Пользователь с таким email уже существует.`,
                    //     {
                    //       reply_markup: {
                    //         inline_keyboard: [
                    //           [
                    //             {
                    //               text: "Список пациентов",
                    //               callback_data: "list_of_patients",
                    //             },
                    //           ],
                    //           [
                    //             {
                    //               text: "Пригласить пациента",
                    //               callback_data: "add_patient",
                    //             },
                    //           ],
                    //           [
                    //             {
                    //               text: "Новые уведомления",
                    //               callback_data: "my_notifications",
                    //             },
                    //             {
                    //               text: "Все уведомления",
                    //               callback_data: "old_notifications",
                    //             },
                    //           ],
                    //         ],
                    //       },
                    //     }
                    //   );
                    // }
                    
                    await bot.sendMessage(chatId, 'Данные получены', {
                      reply_markup: {
                        inline_keyboard: [
                          [{
                            text: 'Зарегистрироваться?',
                            callback_data: 'confirm-registration'
                          }]
                        ]
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
        await bot.sendMessage(chatId, "Опрос успешно отправлен пациенту.", {
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
                  text: "Пригласить пациента",
                  callback_data: "add_patient",
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

          if (doctorResponse?.token) {
            userSessions.set(chatId, doctorResponse.token);
          }

          if (doctorResponse?.token) {
            await bot.sendMessage(
              chatId,
              "Вы успешно авторизованы как доктор!"
            );

            fetchDrugsAndQuestions(doctorResponse?.token);

            const patients = await searchPatients("", 20, doctorResponse.token);

            await bot.sendMessage(chatId, "Что Вас интересует?", {
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
                      text: "Пригласить пациента",
                      callback_data: "add_patient",
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

            if (patients.nodes.length > 0) {
              console.log("List of patients found");
            } else {
              await bot.sendMessage(chatId, "У вас пока нет пациентов.");
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

          if (patientResponse?.token) {
            userSessions.set(chatId, patientResponse.token);
          }

          if (patientResponse?.token) {
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
        await bot.sendMessage(chatId, `Меню`, {
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
                  text: "Пригласить пациента",
                  callback_data: "add_patient",
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

    console.log(JSON.stringify(anotherSurvey));

    const variables: GetQuestionAnswersVariables = {
      patientId: patientId,
      questionId: anotherSurvey[0].questionId,
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

      console.log(allQuestionAnswers);

      // Формируем текстовое сообщение
      if (allQuestionAnswers) {
        // Минимальный ответ: ${item.minAnswer}
        // Максимальный ответ: ${item.maxAnswer}
        let questionAnswersText = allQuestionAnswers
          .map(
            (item: any) => `
Вопрос: ${item.questionTitle}
Ответы: 
${item.answers
  .map(
    (answer: any) =>
      `${answer?.answerQuestionOption?.text} ${
        answer?.createdAt
          ? new Date(answer?.createdAt).toLocaleDateString("ru")
          : "Дата неизвестна"
      }`
  )
  .join("\n")}
---`
          )
          .join("\n");

        let text = [
          `${title}\n${currentPatient?.firstName || ""} ${
            currentPatient?.lastName || ""
          }\nНомер медицинской карты: ${
            currentPatient?.medicalCardNumber || ""
          }`,
          questionAnswersText,
        ].join("\n");

        // Отправляем сообщение в бот
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
      await bot.sendMessage(chatId, "У вас нет новых уведомлений.", {
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
                text: "Пригласить пациента",
                callback_data: "add_patient",
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
      {
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
                text: "Пригласить пациента",
                callback_data: "add_patient",
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
      {
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
                text: "Пригласить пациента",
                callback_data: "add_patient",
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
      await bot.sendMessage(chatId, "У вас нет новых уведомлений.", {
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
      });
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
        doctorId.set(chatId, myDoc[0].doctorId);

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

      await bot.sendMessage(chatId, "Запрос успешно отправлен!", {
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
      });
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

bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  if (data.startsWith("add_patient")) {
    const token = userSessions.get(chatId);

    await bot.sendMessage(chatId, "Введите email для отправки приглашения");

    bot.once("message", async (emailMsg) => {
      const email = emailMsg.text;

      if (email) {
        await bot.sendMessage(chatId, "Введите номер медицинской карты");

        bot.once("message", async (cardMsg) => {
          const medicalCardNumber = cardMsg.text;

          if (medicalCardNumber) {
            await bot.sendMessage(chatId, "Введите имя пациента");

            bot.once("message", async (firstNameMsg) => {
              const firstname = firstNameMsg.text;

              if (firstname) {
                await bot.sendMessage(chatId, "Введите фамилию пациента");

                bot.once("message", async (lastNameMsg) => {
                  const lastname = lastNameMsg.text;

                  if (lastname) {
                    try {
                      const response = await invitePatient(token as string, {
                        medicalCardNumber,
                        email,
                        firstname,
                        lastname,
                      });

                      if (response.status !== 400) {
                        await bot.sendMessage(
                          chatId,
                          "Приглашение успешно отправлено",
                          {
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
                                    text: "Пригласить пациента",
                                    callback_data: "add_patient",
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
                        );
                      }
                    } catch (error: any) {
                      await bot.sendMessage(
                        chatId,
                        `Пользователь с таким email уже существует.`,
                        {
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
                                  text: "Пригласить пациента",
                                  callback_data: "add_patient",
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
                      );
                    }
                  }
                });
              }
            });
          }
        });
      }
    });
  }
});

console.log("Бот запущен...");
