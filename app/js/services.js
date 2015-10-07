// // angular.module('dashApp')
billingApp.factory('authService', ['$http', '$localStorage', 'appConfig', function($http, $localStorage, appConfig){
	var baseUrl = appConfig.server;
	return {
        save: function(data, success, error) {
            $http.post(baseUrl + '/signup', data).success(success).error(error);
        },
        login: function(data, success, error) {
            $http.post(baseUrl + '/login', data).success(success).error(error);
        },
        logout: function(success) {
            delete $localStorage.token;
            success();
        }
    };
}]);

billingApp.factory('api', ['$http', 'appConfig', function($http, appConfig){
    var baseUrl = appConfig.server + '/admin/api';
    return {
        request: function(data, success, error){
            $http.post(baseUrl+data.url, data.params).success(success).error(error);
        }
    };
}]);