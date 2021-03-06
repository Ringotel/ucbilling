var billingApp = angular.module('billingApp', [
	'ngRoute',
	'ngStorage'
]);

var checkLoggedin = function($q, $timeout, $http, $location, $rootScope){
	var deferred = $q.defer(); // Make an AJAX call to check if the user is logged in 
	$http.get('admin/api/loggedin').success(function(res){ // Authenticated 
		if (res.success)
			deferred.resolve(); // Not Authenticated
		else {
			$rootScope.message = 'You need to log in.';
			deferred.reject();
			$location.path('/login');
		}
	});
	return deferred.promise;
};

billingApp.constant('appConfig', {
	server: window.location.protocol + '//' + window.location.host
})
.config(['$routeProvider', '$httpProvider', function($routeProvider, $httpProvider){

	$routeProvider.
		when('/login',{
			templateUrl: 'views/login.html',
			controller: 'AuthController'
		}).
		when('/signup', {
			templateUrl: 'views/signup.html',
			controller: 'AuthController'
		}).
		when('/dashboard', {
			templateUrl: 'views/dashboard.html',
			controller: 'DashController'
		}).
		when('/plans/:id', {
			templateUrl: 'views/plan.html',
			controller: 'PlanController'
		}).
		when('/plans', {
			templateUrl: 'views/plans.html',
			controller: 'PlansController'
		}).
		when('/addons/:id', {
			templateUrl: 'views/addon.html',
			controller: 'AddonController'
		}).
		when('/invoices/:id', {
			templateUrl: 'views/invoice.html',
			controller: 'InvoiceController'
		}).
		// when('/subscriptions/:id', {
		// 	templateUrl: 'views/discount.html',
		// 	controller: 'DiscountController'
		// }).
		when('/coupons/:id', {
			templateUrl: 'views/coupon.html',
			controller: 'CouponController'
		}).
		when('/servers/:id', {
			templateUrl: 'views/server.html',
			controller: 'ServerController'
		}).
		otherwise({
			redirectTo: '/dashboard'
		});

	$httpProvider.interceptors.push(['$q', '$rootScope', '$location', '$localStorage', function($q, $rootScope, $location, $localStorage) {
        return {
			request: function(config) {
				config.headers = config.headers || {};
				if ($localStorage.token) {
					config.headers['x-access-token'] = $localStorage.token;
				}
				return config;
			},
			responseError: function(response) {
				if(response.status === 401 || response.status === 403) {
					$location.path('/login');
				}
				return $q.reject(response);
			},
			response: function(response){
				if(response.data.user){
					$rootScope.currentUser = response.data.user;
				}
				return response;
			}
        };
	}]);
}]);