/**
 * Created by Administrator on 2016/6/16 0016.
 */

var Sequelize = require('sequelize');
var moment = require('moment');

module.exports = function (msgSequelize) {
    return msgSequelize.define(
        'msgmain',
        {
            msgId: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            title: {
                type: Sequelize.STRING,
                allowNull: false
            },
            msgType: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            brandId: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            senderId: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            senderName: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            msgIntr: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            publishDate: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            },
            receiverType: {
                type: Sequelize.INTEGER,
                defaultValue: 1
            },
            status: {
                type: Sequelize.INTEGER,
                defaultValue: 0
            }
        },
        {
            timestamps: false,
            freezeTableName: true,
            tableName: "msgmain"
        }
    );
}
