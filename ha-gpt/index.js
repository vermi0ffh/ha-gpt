require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { User, Entity, Message } = require('./db');
const fs = require('fs');

const prompt = "Tu es un assistant et tu réponds toujours en JSON. Structure ta réponse avec des champs action, entity_id et comment.\n"
    + " - Pour les entités commençant par 'light.', les actions sont : allumer (en JSON : light.turn_on), éteindre (en JSON light.turn_off)\n"
    +  "\n"
    +  "Par exemple, si l'utilisateur souhaite allumer la lumière du salon, ta réponse devra être : {\"action\":\"light.turn_on\", \"entity_id\":\"light.salon\"}.\n";

let config;

try {
    const rawConfig = fs.readFileSync('/data/options.json', 'utf-8');
    config = JSON.parse(rawConfig);
} catch (err) {
    console.error('Erreur lors de la lecture ou de l\'analyse du fichier:', err);
    process.exit(1);
}

const bot = new TelegramBot(config.telegram_token, {polling: true});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    const user = await User.findOrCreate({where: {chatId}});

    if (msg.text.startsWith('/configure ')) {
        const [command, homeAssistantUrl, homeAssistantToken] = msg.text.split(' ');

        user[0].chatId = chatId;
        user[0].homeAssistantUrl = homeAssistantUrl;
        user[0].homeAssistantToken = homeAssistantToken;
        await user[0].save();

        bot.sendMessage(chatId, 'Configuration saved.');
        return;
    }

    if (msg.text.startsWith('/list_entities')) {
        const entitiesResponse = await axios.get(
            `${user[0].homeAssistantUrl}/api/states`,
            {
                headers: {
                    'Authorization': `Bearer ${user[0].homeAssistantToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        for (const entity of entitiesResponse.data) {
            await Entity.findOrCreate({
                where: {entityId: entity.entity_id},
                defaults: {
                    name: entity.attributes.friendly_name || entity.entity_id,
                    aliases: '', // Update this with the correct logic for aliases.
                    userId: user[0].id
                }
            });
        }

        bot.sendMessage(chatId,  'entités purgées');
        return;
    }

    if (msg.text.startsWith('/purge_entities')) {
        for (const entity of await Entity.findAll()) {
            Entity.destroy(
                {
                    where: {
                        userId: user[0].id
                    }
                }
            )
        }

        bot.sendMessage(chatId,   'entités purgées');
        return;
    }

    if (msg.text.startsWith('/add_entity ')) {
        const [command, entityId] = msg.text.split(' ');

        const entityResponse = await axios.get(
            `${user[0].homeAssistantUrl}/api/states/${entityId}`,
            {
                headers: {
                    'Authorization': `Bearer ${user[0].homeAssistantToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        await Entity.findOrCreate({
            where: {entityId: entityResponse.data.entity_id},
            defaults: {
                name: entityResponse.data.attributes.friendly_name || entityResponse.data.entity_id,
                aliases: '', // Update this with the correct logic for aliases.
                userId: user[0].id
            }
        });

        bot.sendMessage(chatId, 'Entité sauvegardée : ' + entityResponse.data.entity_id + " en tant que " + (entityResponse.data.attributes.friendly_name || entityResponse.data.entity_ids));
        return;
    }

    // Liste les entités
    const entities = await Entity.findAll({ where: { userId: user[0].id } });
    let entityList = entities.reduce(
        (carry, enti) => `${carry}\n- ${enti.entityId} (${enti.name})`,
        'Liste des entités actionnables :'
    );

    await Message.create({
        chatId: chatId,
        role: 'user',
        content: msg.text
    });

    const lastMessages = await Message.findAll({
        order: [['id', 'DESC']],
        limit: 20
    });

    const lastMessagesShort = lastMessages.map(entity => ({
        role: entity.role,
        content: entity.content
    }));

    const fullPrompt = prompt + "\n" + (entities.length ? entityList : '');

    lastMessagesShort.push({
        role: 'system',
        content: fullPrompt
    })
    lastMessagesShort.reverse();

    bot.sendChatAction(chatId, 'typing');

    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: "gpt-3.5-turbo",
            messages: lastMessagesShort,
            max_tokens: 400,
            temperature: 0.7,
            user: user[0].chatId
        },
        {
            headers: {
                'Authorization': `Bearer ${config.openia_key}`,
                'Content-Type': 'application/json'
            }
        }
    );

    const retMessage = response.data.choices[0].message.content.trim();

    await Message.create({
        chatId: chatId,
        role: 'assistant',
        content: retMessage
    });

    const action = JSON.parse(retMessage);
    if (action.action) {
        const homeAssistantResponse = await axios.post(
            `${user[0].homeAssistantUrl}/api/services/${action.action.split('.')[0]}/${action.action.split('.')[1]}`,
            {entity_id: action.entity_id},
            {
                headers: {
                    'Authorization': `Bearer ${user[0].homeAssistantToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
    }

    bot.sendMessage(chatId, action.comment);
});

bot.on("polling_error", (err) => {console.log(err); process.exit(1)});
