/**
 * Created by Administrator on 2016/6/20 0020.
 */

var apiCode = require('./api_code_enum');

var convertRequestParamsToLowercase = function (query) {
    var _query = {};
    for (var key in query) {
        _query[key.toLowerCase()] = query[key];
    }
    return _query;
}

module.exports = function*(next) {
    var query, context = this;
    this.getQueryString = function (paramName, defaultValueOrFunction) {
        if (!query) {
            query = convertRequestParamsToLowercase(context.request.query);
        }
        var _type = typeof defaultValueOrFunction;
        var _value = query[paramName.toLowerCase()];
        switch (_type) {
            case "undefined":
                break;
            case "function":
                _value = defaultValueOrFunction(_value);
                break;
            case "number":
                _value = Number(_value);
                break;
            default:
                break;
        }
        if (Object.is(_value, NaN)) {
            throw Object.assign(new Error("参数" + paramName + "类型错误"),
                {errCode: apiCode.errCodeEnum.paramTypeError});
        }

        return Object.is(_value, undefined) && _type !== "function" ? defaultValueOrFunction : _value;
    }
    yield  next;
}
