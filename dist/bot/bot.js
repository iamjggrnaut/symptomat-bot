"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeSurvey = exports.surveyAnswers = exports.currentPatients = exports.doctorId = exports.patientRequest = exports.drugsMap = exports.questionsMap = exports.surveyDataMap = void 0;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const env_1 = require("../config/env");
const auth_handler_1 = require("./handlers/auth.handler");
const auth_handler_2 = require("./handlers/auth.handler");
const api_util_1 = require("../utils/api.util");
const types_1 = require("../utils/types");
const bot = new node_telegram_bot_api_1.default(env_1.TELEGRAM_BOT_TOKEN, { polling: true });
exports.surveyDataMap = new Map();
exports.questionsMap = new Map();
exports.drugsMap = new Map();
exports.patientRequest = new Map();
exports.doctorId = new Map();
exports.currentPatients = new Map();
exports.surveyAnswers = new Map();
exports.activeSurvey = new Map();
const userState = new Map();
const createSurveyData = new Map();
const generateKey = () => Math.random().toString(36).substring(2, 10);
const getQuestionTitle = async (questionId) => {
    for (const drug of exports.drugsMap.values()) {
        const question = drug.questions.find((q) => q.id === questionId);
        if (question) {
            return question.title;
        }
    }
    return "Без названия";
};
let currentPage = 0;
const drugsPerPage = 5;
const showDrugsPage = async (chatId, page) => {
    const drugs = Array.from(exports.drugsMap.values());
    const startIndex = page * drugsPerPage;
    const endIndex = startIndex + drugsPerPage;
    const drugsPage = drugs.slice(startIndex, endIndex);
    // const drugButtons = drugsPage.map((drug) => [
    //   {
    //     text: drug.name,
    //     callback_data: `select_drug_${drug.id}`,
    //   },
    // ]);
    const drugButtons = drugs.map((drug) => [
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
            inline_keyboard: [...drugButtons, paginationButtons],
        },
    });
};
async function askQuestion(chatId, questions, questionIndex) {
    const question = questions[questionIndex]?.question;
    if (!question) {
        await bot.sendMessage(chatId, "Ошибка: вопрос не найден.");
        return;
    }
    switch (question.type) {
        case "RADIO":
        case "CHECKBOX":
            const options = question.options?.map((option) => [
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
            await bot.sendMessage(chatId, `${question.title}\n\nПожалуйста, введите числовое значение:`);
            break;
        default:
            await bot.sendMessage(chatId, "Ошибка: неизвестный тип вопроса.");
            break;
    }
}
async function completeSurvey(chatId, userSurvey) {
    const token = auth_handler_2.userSessions.get(chatId);
    try {
        console.log("Отправка ответов на сервер:", JSON.stringify(userSurvey, null, 2));
        const response = await (0, api_util_1.sendSurveyAnswers)(token, {
            surveyId: userSurvey.surveyId,
            answers: userSurvey.answers,
        });
        console.log("Ответ сервера:", JSON.stringify(response, null, 2));
        if (response.data?.data?.patientCompleteSurvey?.success) {
            await bot.sendMessage(chatId, "Опрос успешно завершен. Спасибо за участие!");
        }
        else {
            const errorMessage = response.data?.patientCompleteSurvey?.problem?.message ||
                "Произошла ошибка при отправке ответов.";
            await bot.sendMessage(chatId, errorMessage);
        }
    }
    catch (error) {
        console.error("Ошибка при отправке ответов:", error.message);
        await bot.sendMessage(chatId, "Произошла ошибка при отправке ответов.");
    }
    finally {
        exports.surveyAnswers.delete(chatId);
    }
}
const fetchDrugsAndQuestions = async (token) => {
    const drugs = await (0, api_util_1.fetchDrugs)(token);
    for (const drug of drugs) {
        const questions = await (0, api_util_1.fetchQuestionsByDrug)(token, drug.id);
        exports.drugsMap.set(drug.id, { ...drug, questions });
    }
};
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Добро пожаловать! Используйте /login для авторизации.");
});
bot.onText(/\/login/, (msg) => {
    (0, auth_handler_1.handleLogin)(bot, msg);
});
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data)
        return;
    if (data.startsWith("drugs_page_")) {
        const page = parseInt(data.split("_")[2], 10);
        await showDrugsPage(chatId, page);
    }
});
// SELECT DRUG
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data)
        return;
    if (data.startsWith("select_drug_")) {
        const drugId = data.split("_")[2];
        const drug = exports.drugsMap.get(drugId);
        if (drug && drug.questions.length > 0) {
            const csdQuestions = drug.questions.map((item) => ({
                questionId: item.id,
                questionType: item.type,
                criticalIndicators: null,
            }));
            const questionsData = exports.questionsMap.get(chatId);
            const patientId = questionsData?.patientId;
            createSurveyData.set(chatId, {
                title: drug.name,
                drugsIds: [drugId],
                patientId: patientId,
                period: "",
                questions: csdQuestions,
                startAt: "",
                endAt: "",
                timezoneOffset: -180,
            });
            userState.set(chatId, types_1.SurveyStep.START_DATE);
            await bot.sendMessage(chatId, "Определите начало периода. Введите число, месяц и год через точку. Пример: 22.02.2025");
        }
        else {
            await bot.sendMessage(chatId, "Вопросы не найдены.");
        }
    }
});
bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const state = userState.get(chatId);
    if (!text || !state)
        return;
    if (state === types_1.SurveyStep.START_DATE || state === types_1.SurveyStep.END_DATE) {
        const input = createSurveyData.get(chatId);
        if (!input)
            return;
        switch (state) {
            case types_1.SurveyStep.START_DATE: {
                const values = text.split(".");
                if (values.length === 3) {
                    const [day, month, year] = values;
                    const startAt = new Date(`${year}-${month}-${day}`);
                    if (isNaN(startAt.getTime())) {
                        await bot.sendMessage(chatId, "Некорректная дата. Попробуйте снова.");
                        return;
                    }
                    createSurveyData.set(chatId, {
                        ...input,
                        startAt: startAt.toISOString(),
                    });
                    userState.set(chatId, types_1.SurveyStep.END_DATE);
                    await bot.sendMessage(chatId, "Определите окончание периода. Введите число, месяц и год через точку. Пример: 22.02.2025");
                }
                else {
                    await bot.sendMessage(chatId, "Некорректный формат даты. Попробуйте снова.");
                }
                break;
            }
            case types_1.SurveyStep.END_DATE: {
                const values = text.split(".");
                if (values.length === 3) {
                    const [day, month, year] = values;
                    const endAt = new Date(`${year}-${month}-${day}`);
                    if (isNaN(endAt.getTime())) {
                        await bot.sendMessage(chatId, "Некорректная дата. Попробуйте снова.");
                        return;
                    }
                    createSurveyData.set(chatId, {
                        ...input,
                        endAt: endAt.toISOString(),
                    });
                    userState.set(chatId, types_1.SurveyStep.PERIOD);
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
                }
                else {
                    await bot.sendMessage(chatId, "Некорректный формат даты. Попробуйте снова.");
                }
                break;
            }
            default:
                break;
        }
    }
    else {
        const userSurvey = exports.surveyAnswers.get(chatId);
        if (!userSurvey ||
            !userSurvey.questions ||
            !Array.isArray(userSurvey.questions))
            return;
        const currentQuestionIndex = userSurvey.answers.length;
        const question = userSurvey.questions[currentQuestionIndex]?.question;
        if (!question)
            return;
        switch (question.type) {
            case "NUMERIC":
            case "SCALE":
            case "TEMPERATURE":
            case "WEIGHT":
            case "PULSE":
                const numericValue = parseFloat(text);
                if (isNaN(numericValue)) {
                    await bot.sendMessage(chatId, "Пожалуйста, введите корректное числовое значение.");
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
                    await bot.sendMessage(chatId, "Пожалуйста, введите давление в формате '120/80'.");
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
        }
        else {
            await completeSurvey(chatId, userSurvey);
        }
    }
});
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data)
        return;
    if (data.startsWith("period-")) {
        const period = data.split("-")[1];
        const input = createSurveyData.get(chatId);
        if (!input)
            return;
        createSurveyData.set(chatId, {
            ...input,
            period,
        });
        userState.set(chatId, types_1.SurveyStep.COMPLETE);
        await bot.sendMessage(chatId, "Опросник успешно создан. Отправить пациенту?", {
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
        });
    }
});
// SEND SURVEY
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data)
        return;
    if (data === "send_survey") {
        const questionsData = exports.questionsMap.get(chatId);
        const patientId = questionsData?.patientId;
        if (!questionsData || !patientId) {
            await bot.sendMessage(chatId, "Ошибка: данные для отправки опроса не найдены.");
            return;
        }
        const input = createSurveyData.get(chatId);
        const token = auth_handler_2.userSessions.get(chatId);
        try {
            const response = await (0, api_util_1.sendSurveyToPatient)(token, input);
            if (response.success) {
                await bot.sendMessage(chatId, "Опрос успешно отправлен пациенту.");
            }
            else {
                await bot.sendMessage(chatId, "Произошла ошибка при отправке опроса.");
            }
        }
        catch (error) {
            await bot.sendMessage(chatId, `${error.message}`);
        }
    }
});
// BACK TO MENU
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data)
        return;
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
    if (!chatId || !data)
        return;
    if (data === "role_doctor") {
        await bot.sendMessage(chatId, "Введите ваш email:");
        bot.once("message", async (emailMsg) => {
            const email = emailMsg.text;
            if (!email) {
                await bot.sendMessage(chatId, "Email не может быть пустым. Попробуйте снова.");
                return;
            }
            await bot.sendMessage(chatId, "Введите ваш пароль:");
            bot.once("message", async (passwordMsg) => {
                const password = passwordMsg.text;
                if (!password) {
                    await bot.sendMessage(chatId, "Пароль не может быть пустым. Попробуйте снова.");
                    return;
                }
                try {
                    const doctorResponse = await (0, api_util_1.loginDoctor)(email, password);
                    if (doctorResponse?.token) {
                        auth_handler_2.userSessions.set(chatId, doctorResponse.token);
                    }
                    if (doctorResponse?.token) {
                        await bot.sendMessage(chatId, "Вы успешно авторизованы как доктор!");
                        fetchDrugsAndQuestions(doctorResponse?.token);
                        const patients = await (0, api_util_1.searchPatients)("", 20, doctorResponse.token);
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
                        }
                        else {
                            await bot.sendMessage(chatId, "У вас пока нет пациентов.");
                        }
                    }
                    else {
                        await bot.sendMessage(chatId, "Ошибка авторизации. Проверьте email и пароль.");
                    }
                }
                catch (error) {
                    await bot.sendMessage(chatId, "Произошла ошибка. Попробуйте снова.");
                }
            });
        });
    }
    else if (data === "role_patient") {
        await bot.sendMessage(chatId, "Введите ваш email:");
        bot.once("message", async (emailMsg) => {
            const email = emailMsg.text;
            if (!email) {
                await bot.sendMessage(chatId, "Email не может быть пустым. Попробуйте снова.");
                return;
            }
            await bot.sendMessage(chatId, "Введите ваш пароль:");
            bot.once("message", async (passwordMsg) => {
                const password = passwordMsg.text;
                if (!password) {
                    await bot.sendMessage(chatId, "Пароль не может быть пустым. Попробуйте снова.");
                    return;
                }
                try {
                    const patientResponse = await (0, api_util_1.loginPatient)(email, password);
                    if (patientResponse?.token) {
                        auth_handler_2.userSessions.set(chatId, patientResponse.token);
                    }
                    if (patientResponse?.token) {
                        await bot.sendMessage(chatId, "Вы успешно авторизованы как пациент!", {
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
                    else {
                        await bot.sendMessage(chatId, "Ошибка авторизации. Проверьте email и пароль.");
                    }
                }
                catch (error) {
                    await bot.sendMessage(chatId, "Произошла ошибка. Попробуйте снова.");
                }
            });
        });
    }
});
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data)
        return;
    if (data.startsWith("my_active_surveys")) {
        const token = auth_handler_2.userSessions.get(chatId);
        try {
            const survey = await (0, api_util_1.myActiveSurveys)(token);
            if (survey &&
                survey.template?.questions &&
                Array.isArray(survey.template.questions)) {
                exports.activeSurvey.set(chatId, survey);
                exports.surveyAnswers.set(chatId, {
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
            }
            else {
                await bot.sendMessage(chatId, "Активных опросов не найдено.");
            }
        }
        catch (error) {
            console.log(error);
            await bot.sendMessage(chatId, "Произошла ошибка при получении опроса.");
        }
    }
});
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data || !data.startsWith("selectsurvey"))
        return;
    const survey = exports.activeSurvey.get(chatId);
    try {
        if (!survey) {
            await bot.sendMessage(chatId, "Произошла ошибка. Попробуйте еще раз позже.");
        }
        else {
            await askQuestion(chatId, survey.template.questions, 0);
        }
    }
    catch (error) {
        console.log(error);
    }
});
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data)
        return;
    // Обработка ответов на RADIO и CHECKBOX
    if (data.startsWith("answer_")) {
        const [, questionIndexStr, answerId] = data.split("_");
        const questionIndex = parseInt(questionIndexStr, 10);
        const userSurvey = exports.surveyAnswers.get(chatId);
        if (!userSurvey ||
            !userSurvey.questions ||
            !Array.isArray(userSurvey.questions))
            return;
        const question = userSurvey.questions[questionIndex]?.question;
        if (!question)
            return;
        // Сохраняем ответ
        if (question.type === "RADIO") {
            userSurvey.answers.push({
                questionId: question.id,
                questionType: question.type,
                answerQuestionOptionId: answerId, // Для RADIO
            });
        }
        else if (question.type === "CHECKBOX") {
            const existingAnswer = userSurvey.answers.find((ans) => ans.questionId === question.id);
            if (existingAnswer) {
                existingAnswer.answerQuestionOptionsIds.push(answerId);
            }
            else {
                userSurvey.answers.push({
                    questionId: question.id,
                    questionType: question.type,
                    answerQuestionOptionsIds: [answerId], // Для CHECKBOX
                });
            }
        }
        if (questionIndex + 1 < userSurvey.questions.length) {
            await askQuestion(chatId, userSurvey.questions, questionIndex + 1);
        }
        else {
            await completeSurvey(chatId, userSurvey);
        }
    }
});
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data)
        return;
    if (data.startsWith("patient_")) {
        const patientId = data.split("_")[1];
        exports.questionsMap.set(chatId, { patientId: patientId, selectedQuestions: [] });
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
    if (!chatId || !data)
        return;
    if (data.startsWith("action_surveys_")) {
        const patientId = data.split("_")[2]?.trim();
        const token = auth_handler_2.userSessions.get(chatId);
        try {
            let surveys = await (0, api_util_1.fetchPatientSurveys)(patientId, null, token);
            if (surveys) {
                const surveyButtons = surveys.map((survey) => {
                    const key = generateKey();
                    exports.surveyDataMap.set(key, {
                        patientId,
                        templateId: survey.id,
                        title: survey.title,
                        survey: survey,
                    });
                    return [
                        {
                            text: `${survey.title} - создан ${new Date(survey.createdAt).toLocaleDateString()}`,
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
            }
            else {
                await bot.sendMessage(chatId, "Опросы не найдены.");
            }
        }
        catch (error) {
            console.error("Ошибка при запросе опросов:", error);
            await bot.sendMessage(chatId, "Произошла ошибка при запросе опросов.");
        }
    }
});
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data)
        return;
    if (data.startsWith("survey_")) {
        const token = auth_handler_2.userSessions.get(chatId);
        const key = data.split("_")[1];
        const { patientId, templateId, title, survey } = exports.surveyDataMap.get(key);
        const patients = exports.currentPatients.get(chatId);
        const currentPatient = patients?.find((pat) => pat.patientId === patientId);
        if (!patientId || !templateId) {
            await bot.sendMessage(chatId, "Данные не найдены.");
            return;
        }
        let anotherSurvey = await (0, api_util_1.fetchOneSurveyAnswers)(patientId, templateId, token);
        if (anotherSurvey) {
            let questionAnswwers = anotherSurvey
                .map((item) => `
          ${item.questionTitle}
          ${item.minAnswer}
          ${item.maxAnswer}
            `)
                .join("\n");
            let text = [
                `${title}\n${currentPatient?.firstName || ""} ${currentPatient?.firstName || ""}\nНомер медицинской карты: ${currentPatient?.medicalCardNumber || ""}`,
                questionAnswwers,
            ].join("\n");
            await bot.sendMessage(chatId, text ? text : "Нет данных");
        }
    }
});
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data)
        return;
    if (data.startsWith("list_of_patients")) {
        const token = auth_handler_2.userSessions.get(chatId);
        const patients = await (0, api_util_1.searchPatients)("", 20, token);
        exports.currentPatients.set(chatId, patients?.nodes);
        if (patients?.nodes.length > 0) {
            const patientButtons = patients?.nodes.map((patient) => [
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
        }
        else {
            await bot.sendMessage(chatId, "У вас пока нет пациентов.");
        }
    }
});
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data)
        return;
    const token = auth_handler_2.userSessions.get(chatId);
    if (data.startsWith("my_notifications")) {
        if (!token) {
            await bot.sendMessage(chatId, "Вы не авторизованы. Пожалуйста, авторизуйтесь.");
            return;
        }
        const notifications = await (0, api_util_1.fetchDoctorNotifications)(chatId.toString(), 20, "20", token);
        const newNotifications = notifications?.nodes?.filter((item) => !item.isRead);
        if (!notifications ||
            notifications?.nodes?.length === 0 ||
            newNotifications?.length === 0) {
            await bot.sendMessage(chatId, "У вас нет новых уведомлений.");
            return;
        }
        const formattedNotifications = newNotifications
            ?.map((edge) => {
            return `📅 ${new Date(edge.createdAt).toLocaleString()}\n📝 ${edge.description}`;
        })
            .join("\n\n");
        await bot.sendMessage(chatId, `Ваши новые уведомления:\n\n${formattedNotifications}`, {
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
    }
    else if (data.startsWith("old_notifications")) {
        if (!token) {
            await bot.sendMessage(chatId, "Вы не авторизованы. Пожалуйста, авторизуйтесь.");
            return;
        }
        const notifications = await (0, api_util_1.fetchDoctorNotifications)(chatId.toString(), 20, "20", token);
        console.log(notifications);
        if (!notifications || notifications.nodes.length === 0) {
            await bot.sendMessage(chatId, "У вас нет уведомлений.");
            return;
        }
        const formattedNotifications = notifications.nodes
            .map((edge) => {
            return `📅 ${new Date(edge.createdAt).toLocaleString()}\n📝 ${edge.description}`;
        })
            .join("\n\n");
        await bot.sendMessage(chatId, `Все уведомления:\n\n${formattedNotifications}`, {
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
    }
});
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data)
        return;
    if (data.startsWith("notifications_patient")) {
        const token = auth_handler_2.userSessions.get(chatId);
        const notifications = await (0, api_util_1.fetchPatientNotifications)(10, token);
        const newNotifications = notifications?.nodes?.filter((item) => !item.isRead);
        if (!notifications ||
            notifications?.nodes?.length === 0 ||
            newNotifications?.length === 0) {
            await bot.sendMessage(chatId, "У вас нет новых уведомлений.");
            return;
        }
        const formattedNotifications = newNotifications
            ?.map((edge) => {
            return `📅 ${new Date(edge.createdAt).toLocaleString()}\n📝 ${edge.title}`;
        })
            .join("\n\n");
        await bot.sendMessage(chatId, `Ваши новые уведомления:\n\n${formattedNotifications}`, {
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
});
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data)
        return;
    if (data.startsWith("action_create_survey_")) {
        const token = auth_handler_2.userSessions.get(chatId);
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
    if (!chatId || !data)
        return;
    if (data.startsWith("selectdrug")) {
        const token = auth_handler_2.userSessions.get(chatId);
        await showDrugsPage(String(chatId), currentPage);
    }
});
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data)
        return;
    const token = auth_handler_2.userSessions.get(chatId);
    if (data.startsWith("contact_")) {
        await bot.sendMessage(chatId, "Введите Ваше сообщение: ");
        const myDoc = await (0, api_util_1.getMyDoc)(token);
        if (myDoc && myDoc.length > 0) {
            try {
                exports.doctorId.set(chatId, myDoc[0].doctorId);
                bot.once("message", async (message) => {
                    const text = message.text;
                    exports.patientRequest.set(chatId, text);
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
            }
            catch (error) {
                console.log(error);
                throw error;
            }
        }
    }
});
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data)
        return;
    if (data.startsWith("send_request")) {
        const token = auth_handler_2.userSessions.get(chatId);
        const message = exports.patientRequest.get(chatId);
        const docId = exports.doctorId.get(chatId);
        try {
            await (0, api_util_1.contactMeRequest)(token, docId, message);
            await bot.sendMessage(chatId, "Запрос успешно отправлен!");
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }
});
bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    if (!chatId || !data)
        return;
    if (data.startsWith("add_patient")) {
        const token = auth_handler_2.userSessions.get(chatId);
        await bot.sendMessage(chatId, "Введите email для отправки приглашения");
        bot.once("message", async (emailMsg) => {
            const email = emailMsg.text;
            if (email) {
                bot.sendMessage(chatId, `Введите номер медицинской карты`);
                bot.once("message", async (card) => {
                    const medicalCardNumber = card.text;
                    if (medicalCardNumber) {
                        try {
                            const response = await (0, api_util_1.invitePatient)(token, {
                                medicalCardNumber,
                                email,
                            });
                            if (response.status === 200) {
                                await bot.sendMessage(chatId, "Приглашение успешно отправлено");
                            }
                        }
                        catch (error) {
                            await bot.sendMessage(chatId, `${error.message}`);
                        }
                    }
                });
            }
        });
    }
});
console.log("Бот запущен...");
