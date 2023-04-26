import { Configuration, OpenAIApi } from 'openai'
import config from 'config'
import { createReadStream } from 'fs'



class OpenAI {
    roles = {
        ASSISTANT: 'assistant',
        USER: 'user',
        SYSTEM: 'system'
    }

    constructor(apiKey) {
        const configuration = new Configuration({
            apiKey,
        });
        this.openai = new OpenAIApi(configuration);
    }

    async chat(messages) {
        try {
            const responce = await this.openai.createChatCompletion({
                model: 'gpt-3.5-turbo',
                messages,
            })
            return responce.data.choices[0].message
        } catch (e) {
            console.error(e)
        }
    }

    async transcription(filepath) {
        try {
            const responce = await this.openai.createTranscription(
                createReadStream(filepath),
                'whisper-1'
            )
            return responce.data.text
        } catch (e) {
            console.error(e)
        }
    }
}

export const openai = new OpenAI(config.get('OPENAI_KEY'))