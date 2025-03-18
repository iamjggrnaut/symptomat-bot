import TelegramBot from "node-telegram-bot-api";
import {
  loginDoctor,
  loginPatient,
  searchPatients,
} from "../../utils/api.util";
import { error } from "console";

export const userSessions = new Map<number, string>();

export const handleLogin = async (
  bot: TelegramBot,
  msg: TelegramBot.Message
) => {
  const chatId = msg.chat.id;

  await bot.sendMessage(chatId, "Выберите роль:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Доктор", callback_data: "role_doctor" }],
        [{ text: "Пациент", callback_data: "role_patient" }],
      ],
    },
  });
};
