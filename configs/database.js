/**
 * Created by Administrator on 2016/6/16 0016.
 */

var Sequelize = require('sequelize');
var dbConfig = process.env.NODE_ENV === 'production'
    ? require('./dbconfig_pro.json')
    : require('./dbconfig.json');

var msgDbContents = function () {
    var msgDbConfig = dbConfig.epaperMsg;
    var messageSequelize = new Sequelize(msgDbConfig.database, msgDbConfig.username, msgDbConfig.password, msgDbConfig.config);
    var models = {
        msgMain: require('../models/message/msgmain')(messageSequelize),
        msgReceiver: require('../models/message/msgreceiver')(messageSequelize),
        msgContent: require('../models/message/msgcontent')(messageSequelize),
    };
    InitDbModels(models);
    return Object.assign(messageSequelize, models);
}

var workDbContents = function () {
    var workDbConfig = dbConfig.epaperWork;
    var workSequelize = new Sequelize(workDbConfig.database, workDbConfig.username, workDbConfig.password, workDbConfig.config);

    var models = {
        eworks: require('../models/epaperwork/eworks')(workSequelize),
        doEworks: require('../models/epaperwork/doeworks')(workSequelize),
        workBatch: require('../models/epaperwork/workbatch')(workSequelize),
        workMembers: require('../models/epaperwork/workmembers')(workSequelize),
        workContents: require('../models/epaperwork/workcontents')(workSequelize),
    }
    InitDbModels(models);
    return Object.assign(workSequelize, models);
}

function InitDbModels(models) {
    Object.keys(models).forEach(item=> {
        if (typeof models[item].associate === 'function') {
            models[item].associate(models);
        }
    });
}

module.exports = function () {
    return new Promise(function (resolve, reject) {
        resolve(getDbContents());
    });
}

var getDbContents = module.exports.getDbContents = function () {
    return {
        Sequelize: Sequelize,
        messageSequelize: msgDbContents(),
        workSequelize: workDbContents(),
    }
}




