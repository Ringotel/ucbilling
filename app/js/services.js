// // angular.module('dashApp')
billingApp.factory('authService', ['$http', '$localStorage', 'appConfig', function($http, $localStorage, appConfig){
	var baseUrl = appConfig.server;
	return {
        save: function(data, success, error) {
            $http.post(baseUrl + '/admin/api/signup', data).success(success).error(error);
        },
        login: function(data, success, error) {
            $http.post(baseUrl + '/admin/api/login', data).success(success).error(error);
        },
        logout: function(success) {
            delete $localStorage.token;
            success();
        }
    };
}]);

billingApp.factory('api', ['$http', 'appConfig', function($http, appConfig){
    var baseUrl = appConfig.server + '/admin/api';

    function objToParams(obj) {
        return Object.keys(obj).reduce(function(str, key) {
            str += (key+'='+obj[key]);
            return str;
        }, "");
    }

    return {
        request: function(data, success, error){
            $http.post(baseUrl+data.url, data.params).success(success).error(error);
        },
        post: function(data, success, error) {
            $http.post(baseUrl+data.url, data.params).success(success).error(error);
        },
        get: function(data, success, error) {
            $http.get(baseUrl+data.url+'?'+objToParams(data.params)).success(success).error(error);  
        }
    };
}]);