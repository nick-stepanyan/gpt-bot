import { Telegraf, session } from "telegraf"
import { message } from 'telegraf/filters'
import config from 'config'
import { ogg } from './ogg.js'
import { openai } from './openai.js'


const INITIAL_SESSION = {
    messages: [],
}

const ALLOWED_USERS = ['530228812', '976279493', '5582758805', '658917063', '1615746145'];

const userName = {
    '530228812': 'Luna ',
    '5582758805': 'Father',
    '658917063': 'Litle Big',
    '1615746145': 'Nina',
    '323': 'Alena Salehard',
    '976279493': 'Admin'
}


const bot = new Telegraf(config.get('TELEGRAM_TOKEN'))

const sendTelegramMessage = async(chatId, message) => {
    try {
        await bot.telegram.sendMessage(chatId, message)
        console.log('Message sent.')
    } catch (e) {
        console.error(e)
    }
}

bot.use(session())
bot.command('start', async(ctx) => {

    if (ALLOWED_USERS.includes(String(ctx.message.from.id))) { // проверяем идентификатор пользователя
        ctx.session = INITIAL_SESSION
        await ctx.reply('Жду вашего голосового или текстового сообщения')
    } else {
        await ctx.reply('У вас нет доступа к этому боту')
    }
});




bot.on(message('voice'), async(ctx) => {

    if (ALLOWED_USERS.includes(String(ctx.message.from.id))) {
        ctx.session = ctx.session || INITIAL_SESSION;
        try {

            const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
            const userId = String(ctx.message.from.id);
            const oggPath = await ogg.create(link.href, userId);
            const mp3Path = await ogg.toMp3(oggPath, userId);
            const text = await openai.transcription(mp3Path);

            ctx.session.messages.push({ role: openai.roles.USER, content: text }); // сохраняем текст сообщения

            if (!ctx.session.intervalId) { // создаем интервал только если его нет
                ctx.session.intervalId = setInterval(() => {
                    ctx.session.messages.push({ role: openai.roles.USER, content: '' }); // пишем пустое сообщение, чтобы сессия не прерывалась из-за отсутствия новых сообщений
                }, 10000);
            }

            const replyPromise = ctx.replyWithChatAction('typing');
            const responce = await openai.chat(ctx.session.messages);

            clearInterval(ctx.session.intervalId); // очищаем интервал при получении ответа

            ctx.session.messages.push({ role: openai.roles.ASSISTANT, content: responce.content });

            await replyPromise;
            await ctx.reply(responce.content);
            ctx.session.intervalId = null; // сбрасываем интервал
            if (String(ctx.message.from.id) !== '976279493') {
                await ctx.reply(userName[ctx.message.from.id])
                await ctx.telegram.sendVoice('976279493', ctx.message.voice.file_id)
                await sendTelegramMessage('976279493', `Ответ: ${responce.content}`)
            }
        } catch (e) {
            console.error(e);
            clearInterval(ctx.session.intervalId); // очищаем интервал при ошибке
            ctx.session.intervalId = null; // сбрасываем интервал
            if (e.message === 'Response timeout') {
                await ctx.reply('Сервер не отвечает, пожалуйста, попробуйте ещё раз позже...');
            } else {
                await ctx.reply('Произошла ошибка при обработке запроса, пожалуйста, попробуйте ещё раз позже...');
            }
        }
    } else {
        await ctx.reply('У вас нет доступа к этому боту')
    }

});

bot.on(message('text'), async(ctx) => {
    console.log(String(ctx.message.from.id))
    if (ALLOWED_USERS.includes(String(ctx.message.from.id))) { // проверяем идентификатор пользователя
        ctx.session = ctx.session || INITIAL_SESSION;
        try {
            ctx.session.messages.push({ role: openai.roles.USER, content: ctx.message.text })
            const replyPromise = ctx.replyWithChatAction('typing')
            const responcePromise = openai.chat(ctx.session.messages)

            let responce = await Promise.race([
                responcePromise,
                new Promise((reject) => {
                    setTimeout(() => reject(new Error('Response timeout')), 10000)
                })
            ])

            ctx.session.messages.push({
                role: openai.roles.ASSISTANT,
                content: responce.content
            });

            await replyPromise;

            await ctx.reply(responce.content); // отправить ответ только после завершения анимации
            if (String(ctx.message.from.id) !== '976279493') {
                sendTelegramMessage('976279493', `${userName[ctx.message.from.id]}: ${ctx.message.text} \n Ответ: ${responce.content}`)
            }
        } catch (e) {
            console.error(e)

            if (e.message === 'Response timeout') {
                await ctx.reply('Сервер не отвечает, пожалуйста, попробуйте ещё раз позже...')
            } else {
                await ctx.reply('Произошла ошибка при обработке запроса, пожалуйста, попробуйте ещё раз позже...')
            }
        }
    } else {
        await ctx.reply('У вас нет доступа к этому боту')
    }
});

bot.launch()

process.once('SIGINT', () => bot.stop('SIGNIT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))