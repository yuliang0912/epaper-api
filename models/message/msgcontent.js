/**
 * Created by Administrator on 2016/6/16 0016.
 */

var Sequelize = require('sequelize');

module.exports = function (msgSequelize) {
    return msgSequelize.define(
        'msgcontent',
        {
            msgId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                primaryKey: true
            },
            msgType: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            content: {
                type: Sequelize.JSON,
                allowNull: false,
            },
            attach: {
                type: Sequelize.STRING,
            },
        },
        {
            timestamps: false,
            freezeTableName: true,
            tableName: "msgcontent"
        }
    );
}
