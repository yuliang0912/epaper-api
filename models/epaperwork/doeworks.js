/**
 * Created by Administrator on 2016/6/22 0022.
 */

var Sequelize = require('sequelize');

module.exports = function (workSequelize) {
    return workSequelize.define(
        'doeworks',
        {
            doWorkId: {
                type: Sequelize.BIGINT,
                primaryKey: true
            },
            userId: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            userName: {
                type: Sequelize.STRING,
                allowNull: false
            },
            packageId: {
                type: Sequelize.BIGINT,
                allowNull: false
            },
            cid: {
                type: Sequelize.STRING,
                allowNull: false
            },
            moduleId: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            resourceName: {
                type: Sequelize.STRING,
                allowNull: false
            },
            versionId: {
                type: Sequelize.STRING,
                allowNull: false
            },
            parentVersionId: {
                type: Sequelize.BIGINT,
                allowNull: false
            },
            resourceType: {
                type: Sequelize.STRING,
                allowNull: false
            },
            submitDate: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            },
            doWorkPackageUrl: {
                type: Sequelize.STRING,
                allowNull: false
            },
            workId: {
                type: Sequelize.BIGINT
            },
            workScore: {
                type: Sequelize.DECIMAL(6, 2),
                defaultValue: 100
            },
            actualScore: {
                type: Sequelize.DECIMAL(6, 2)
            },
            workLong: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            brandId: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            comment: {
                type: Sequelize.STRING,
                defaultValue: ''
            },
            commentType: {
                type: Sequelize.INTEGER,
                defaultValue: 1
            },
            workStatus: {
                type: Sequelize.INTEGER,
            },
            classId: {
                type: Sequelize.INTEGER,
            },
            delStatus: {
                type: Sequelize.INTEGER,
                defaultValue: 0
            },
            codeId: {
                type: Sequelize.INTEGER,
                defaultValue: 0
            },
            insteadUserId: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            insteadUserName: {
                type: Sequelize.STRING,
                allowNull: false
            },
            submitCount: {
                type: Sequelize.STRING,
            },
            logInfo: {
                type: Sequelize.STRING,
            },
            sourceType: {
                type: Sequelize.INTEGER,
            }
        },
        {
            timestamps: false,
            freezeTableName: true,
            tableName: "doeworks",
            classMethods: {
                associate: function (models) { // N:1
                    this.belongsTo(models.eworks, {foreignKey: 'workId'});
                }
            }
        }
    );
}
