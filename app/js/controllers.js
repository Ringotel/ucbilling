billingApp.controller('DashController', ['$rootScope', '$scope', '$location', 'api', 'authService', function($rootScope, $scope, $location, api, authService){
	
	$scope.plans = [];

	api.request({
		url: '/plans/'
	}, function(result){
		$scope.plans = result;
	}, function(err){
		$rootScope.error = err;
	});

	$scope.logout = function(){
		authService.logout(function(){
			$location.path('/');
			$rootScope.currentUser = '';
		});
	};

}]);

billingApp.controller('PlanController', ['$rootScope', '$routeParams', '$scope', 'api', function($rootScope, $routeParams, $scope, api){
	
	var id = $routeParams.id;

	$scope.plan = {};

	if(id !== 'new'){
		api.request({
			url: '/plans/get/'+id
		}, function(result){
			$scope.plan = result.data;
		}, function(err){
			$rootScope.error = err;
		});
	}
	
	$scope.setPlan = function(){
		console.log($scope.plan);
		// if($scope.plan.trialPeriod === true)
		// 	$scope.plan.trialExpires = Date.now() + ($scope.plan.trialDuration * 24 * 60 * 60 * 1000);
		api.request({
			url: '/plans/'+(id === 'new' ? 'add' : 'update/'+id),
			params: $scope.plan
		}, function(result){
			console.log(result);
		}, function(err){
			$rootScope.error = err;
		});
	};

}]);

billingApp.controller('AddonController', ['$rootScope', '$routeParams', '$scope', 'api', function($rootScope, $routeParams, $scope, api){
	
	var id = $routeParams.id;

	$scope.addon = {};

	if(id !== 'new'){
		api.request({
			url: '/addons/get/'+id
		}, function(result){
			$scope.addon = result.data;
		}, function(err){
			$rootScope.error = err;
		});
	}
	
	$scope.setAddon = function(){
		console.log($scope.addon);
		
		api.request({
			url: '/addons/'+(id === 'new' ? 'add' : 'update/'+id),
			params: $scope.addon
		}, function(result){
			console.log(result);
		}, function(err){
			$rootScope.error = err;
		});
	};

	$scope.deleteAddon = function(){
		api.request({
			url: '/addons/delete/'+id,
			params: $scope.addon
		}, function(result){
			console.log(result);
		}, function(err){
			$rootScope.error = err;
		});
	};

}]);

billingApp.controller('AuthController', ['$rootScope', '$scope', '$location', '$localStorage', 'authService', function($rootScope, $scope, $location, $localStorage, authService){
	
	$scope.signup = function(){
		var fdata = {
			email: $scope.email,
			name: $scope.name,
			// country: $scope.country,
			password: $scope.password
		};

		authService.save(fdata, function(res){
			if(!res.success){
				alert(res.message);
			} else {
				$localStorage.token = res.token;
				$location.path('/dashboard');
			}
		}, function(err){
			$rootScope.error = err;
		});
	};

	$scope.login = function(){
		var fdata = {
			email: $scope.email,
			password: $scope.password
		};

		authService.login(fdata, function(res){
			if(!res.success){
				alert(res.message);
			} else {
				$localStorage.token = res.token;
				$location.path('/dashboard');
			}
		}, function(err){
			$rootScope.error = err;
		});
	};

	$scope.logout = function() {
        authService.logout(function() {
            $location.path('/');
            $rootScope.currentUser = '';
        }, function(err) {
            $rootScope.error = err;
        });
    };
}]);
