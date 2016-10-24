/**
 * Created by yuliang on 2016/10/24.
 */

var Sequelize = require('sequelize');

module.exports = function (msgSequelize) {
    return msgSequelize.define(
        'userLogs',
        {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            userId: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            brandId: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            logInfo: {
                type: Sequelize.JSON,
                allowNull: false,
            },
            createDate: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            },
        },
        {
            timestamps: false,
            freezeTableName: true,
            tableName: "userLogs"
        }
    );
}
