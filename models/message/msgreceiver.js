/**
 * Created by Administrator on 2016/6/16 0016.
 */

var Sequelize = require('sequelize');

module.exports = function (msgSequelize) {
    return msgSequelize.define(
        'msgreceiver',
        {
            msgId: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            receiverId: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            receiverName: {
                type: Sequelize.STRING,
                allowNull: false
            },
            msgStatus: {
                type: Sequelize.INTEGER,
                defaultValue: 0
            },
            updateDate: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW,
                allowNull: false
            }
        },
        {
            timestamps: false,
            freezeTableName: true,
            tableName: "msgreceiver",
            indexes: [
                {
                    unique: true,
                    fields: ['msgId', 'receiverId']
                }
            ],
        }
    );
}

