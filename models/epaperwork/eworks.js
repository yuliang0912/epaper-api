/**
 * Created by Administrator on 2016/6/22 0022.
 */

var Sequelize = require('sequelize');

module.exports = function (workSequelize) {
    return workSequelize.define(
        'eworks',
        {
            workId: {
                type: Sequelize.STRING,
                primaryKey: true
            },
            workName: {
                type: Sequelize.STRING,
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
            brandId: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            workType: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            batchId: {
                type: Sequelize.INTEGER
            },
            publishDate: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            },
            effectiveDate: {
                type: Sequelize.DATE,
                allowNull: false
            },
            workMessage: {
                type: Sequelize.STRING,
                allowNull: false
            },
            workMessageType: {
                type: Sequelize.INTEGER,
                defaultValue: 1
            },
            totalNum: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            subjectId: {
                type: Sequelize.INTEGER,
            },
            classId: {
                type: Sequelize.BIGINT
            },
            schoolId: {
                type: Sequelize.BIGINT
            },
            schoolName: {
                type: Sequelize.STRING
            },
            areaCode: {
                type: Sequelize.STRING
            },
            sourceType: {
                type: Sequelize.INTEGER,
            },
            tags: {
                type: Sequelize.STRING
            },
            status: {
                type: Sequelize.INTEGER,
            }
        },
        {
            timestamps: false,
            freezeTableName: true,
            tableName: "eworks",
            classMethods: {
                associate: function (models) {
                    this.belongsTo(models.workBatch, {foreignKey: 'batchId'}); // 1:1
                    this.hasMany(models.doEworks, {foreignKey: 'workId'}); //1:N
                    this.hasMany(models.workMembers, {foreignKey: 'workId'}); //1:N
                }
            }
        }
    );
}