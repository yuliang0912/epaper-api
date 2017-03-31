/**
 * Created by Administrator on 2016/6/24 0024.
 */

var Sequelize = require('sequelize');

module.exports = function (workSequelize) {
    return workSequelize.define(
        'workbatch',
        {
            batchId: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            workName: {
                type: Sequelize.STRING,
                allowNull: false
            },
            brandId: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            workType: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            publishUserId: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            publishUserName: {
                type: Sequelize.STRING,
                allowNull: false
            },
            publishDate: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            },
            sendDate: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            },
            effectiveDate: {
                type: Sequelize.DATE,
                allowNull: false
            },
            workCount: {
                type: Sequelize.INTEGER,
            },
            pushStatus: {
                type: Sequelize.INTEGER,
                defaultValue: 0
            }
        },
        {
            timestamps: false,
            freezeTableName: true,
            tableName: "workbatch",
            classMethods: {
                associate: function (models) {  // 1:N
                    this.hasMany(models.eworks, {foreignKey: 'batchId'})
                }
            }
        }
    );
}