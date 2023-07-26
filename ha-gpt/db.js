const { Sequelize, DataTypes, Model } = require('sequelize');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: '/data/database.sqlite'
});

class User extends Model {}

User.init({
    chatId: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
    },
    homeAssistantUrl: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    homeAssistantToken: {
        type: DataTypes.STRING,
        allowNull: true,
    }
}, {
    sequelize,
    modelName: 'User'
});

class Entity extends Model {}

Entity.init({
    entityId: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    aliases: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
    }
}, {
    sequelize,
    modelName: 'Entity'
});

class Message extends Model {}

Message.init({
    chatId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    role: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    content: {
        type: DataTypes.STRING,
        allowNull: false,
    }
}, {
    sequelize,
    modelName: 'Message'
});


sequelize.sync();

module.exports = {
    User,
    Entity,
    Message
};
