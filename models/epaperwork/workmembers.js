/**
 * Created by Administrator on 2016/7/1 0001.
 */

var Sequelize = require('sequelize');

module.exports = function (workSequelize) {
    return workSequelize.define(
        'eworkmembers',
        {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            workId: {
                type: Sequelize.BIGINT
            },
            userId: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            userName: {
                type: Sequelize.STRING,
                allowNull: false
            },
            status: {
                type: Sequelize.INTEGER,
            },
            isRead: {
                type: Sequelize.INTEGER,
            },
        },
        {
            timestamps: false,
            freezeTableName: true,
            tableName: "eworkmembers",
            classMethods: {
                associate: function (models) { // 1:1
                    this.belongsTo(models.eworks, {foreignKey: 'workId'});
                }
            }
        }
    );
}