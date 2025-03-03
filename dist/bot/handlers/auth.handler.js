"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleLogin = exports.userSessions = void 0;
exports.userSessions = new Map();
const handleLogin = async (bot, msg) => {
    const chatId = msg.chat.id;
    // Предлагаем выбрать роль с помощью inline-кнопок
    await bot.sendMessage(chatId, "Выберите роль:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "Доктор", callback_data: "role_doctor" }],
                [{ text: "Пациент", callback_data: "role_patient" }],
            ],
        },
    });
};
exports.handleLogin = handleLogin;
