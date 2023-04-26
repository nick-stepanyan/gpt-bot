import { Telegraf, session } from "telegraf"
import { message } from 'telegraf/filters'
import config from 'config'
import { ogg } from './ogg.js'
import { openai } from './openai.js'

const INITIAL_SESSION = {
    messages: [],
}

const bot = new Telegraf(config.get('TELEGRAM_TOKEN'))

bot.use(session())
bot.command('start', async(ctx) => {
    ctx.session = INITIAL_SESSION
    await ctx.reply('Жду вашего голосового или текстового сообщения')
})
bot.on(message('voice'), async(ctx) => {
    ctx.session = ctx.session || INITIAL_SESSION;
    try {
        const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
        const userId = String(ctx.message.from.id)
        const oggPath = await ogg.create(link.href, userId)
        const mp3Path = await ogg.toMp3(oggPath, userId)
        const text = await openai.transcription(mp3Path)

        ctx.session.messages.push({ role: openai.roles.USER, content: text })
        const replyPromise = ctx.replyWithChatAction('typing')
        const responce = await openai.chat(ctx.session.messages)

        ctx.session.messages.push({
            role: openai.roles.ASSISTANT,
            content: responce.content
        })
        await replyPromise;
        await ctx.reply(responce.content)
    } catch (e) {
        console.error(e)
    }
})

bot.on(message('text'), async(ctx) => {
    ctx.session = ctx.session || INITIAL_SESSION;

    try {
        ctx.session.messages.push({ role: openai.roles.USER, content: ctx.message.text })
        await new Promise(resolve => setTimeout(resolve, 2000)) // задержка
        const replyPromise = ctx.replyWithChatAction('typing')
        const responce = await openai.chat(ctx.session.messages)

        ctx.session.messages.push({
            role: openai.roles.ASSISTANT,
            content: responce.content
        });

        await replyPromise;
        await ctx.reply(responce.content); // отправить ответ только после завершения анимации
    } catch (e) {
        console.error(e)
    }
});

bot.launch()

process.once('SIGINT', () => bot.stop('SIGNIT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))