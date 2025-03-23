"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSelectRole = exports.userSessions = void 0;
exports.userSessions = new Map();
const handleSelectRole = async (bot, msg) => {
    const chatId = msg?.chat?.id;
    await bot.sendMessage(chatId, "Выберите роль:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "Доктор", callback_data: "role_doctor" }],
                [{ text: "Пациент", callback_data: "role_patient" }],
            ],
        },
    });
};
exports.handleSelectRole = handleSelectRole;
