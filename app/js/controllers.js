billingApp.controller('SidebarController', ['$rootScope', '$scope', '$location', 'authService', function($rootScope, $scope, $location, authService){
	$scope.visible = false;
	$scope.$on('$routeChangeSuccess', function(){
		if($location.path() === '/' || $location.path() === '/login' || $location.path() === '/signup'){
			$scope.visible = false;
			$rootScope.fullView = true;
		} else {
			$scope.visible = true;
			$rootScope.fullView = false;
		}
	});
	$scope.logout = function(){
		authService.logout(function(){
			$location.path('/');
			$rootScope.currentUser = '';
		});
	};
}]);

billingApp.controller('TopmenuController', ['$rootScope', '$scope', '$location', function($rootScope, $scope, $location){
	$scope.visible = false;
	$scope.$watch(function(){
		return $rootScope.title;
	}, function(val){
		$scope.pageTitle = val;
	});
	$scope.$on('$routeChangeSuccess', function(){
		if($location.path() === '/' || $location.path() === '/login' || $location.path() === '/signup' || $location.path() === '/account-verification')
			$scope.visible = false;
		else
			$scope.visible = true;
	});
}]);

billingApp.controller('DashController', ['$rootScope', '$scope', '$location', 'api', 'authService', function($rootScope, $scope, $location, api, authService){
	
	$scope.plans = [];
	$rootScope.title = "Dashboard";

	api.request({
		url: '/plans/'
	}, function(result){
		$scope.plans = result;
	}, function(err){
		$rootScope.error = err;
	});

	api.request({
		url: '/addons/'
	}, function(result){
		$scope.addons = result;
	}, function(err){
		$rootScope.error = err;
	});

	api.request({
		url: '/servers/'
	}, function(result){
		$scope.servers = result;
	}, function(err){
		$rootScope.error = err;
	});

	api.request({
		url: '/discounts/'
	}, function(result){
		$scope.discounts = result;
	}, function(err){
		$rootScope.error = err;
	});

}]);

billingApp.controller('PlanController', ['$rootScope', '$routeParams', '$scope', 'api', function($rootScope, $routeParams, $scope, api){
	
	var id = $routeParams.id;
	$rootScope.title = "Plan";

	$scope.plan = {};

	if(id !== 'new'){
		api.request({
			url: '/plans/get/'+id
		}, function(result){
			console.log(result);
			if(result.result.customData) {
				result.result.customData = JSON.stringify(result.result.customData);
			}
			$scope.plan = result.result;
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

	$scope.deletePlan = function(){
		api.request({
			url: '/plans/delete/'+id,
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
	$rootScope.title = "Addon";

	$scope.addon = {};

	if(id !== 'new'){
		api.request({
			url: '/addons/get/'+id
		}, function(result){
			$scope.addon = result.result;
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

billingApp.controller('ServerController', ['$rootScope', '$routeParams', '$scope', 'api', function($rootScope, $routeParams, $scope, api){
	
	var id = $routeParams.id;
	$rootScope.title = "Server";

	$scope.object = {};

	if(id !== 'new'){
		api.request({
			url: '/servers/get/'+id
		}, function(result){
			$scope.object = result.result;
		}, function(err){
			$rootScope.error = err;
		});
	}
	
	$scope.setObject = function(){
		console.log($scope.object);
		
		api.request({
			url: '/servers/'+(id === 'new' ? 'add' : 'update/'+id),
			params: $scope.object
		}, function(result){
			console.log(result);
		}, function(err){
			$rootScope.error = err;
		});
	};

	$scope.deleteObject = function(){
		api.request({
			url: '/servers/delete/'+id,
			params: $scope.object
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
			login: $scope.login,
			email: $scope.email,
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

	$scope.logIn = function(){
		var fdata = {
			login: $scope.login,
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
