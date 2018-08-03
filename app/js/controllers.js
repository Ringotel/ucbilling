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
	
	$rootScope.title = "Dashboard";

	$scope.plans = [];
	$scope.toDate = function(string) {
		return new Date(string).toLocaleDateString();
	};

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
		url: '/coupons/'
	}, function(result){
		$scope.coupons = result;
	}, function(err){
		$rootScope.error = err;
	});

	api.request({
		url: '/invoices/'
	}, function(result){
		$scope.invoices = result;
	}, function(err){
		$rootScope.error = err;
	});

	api.request({
		url: '/subscriptions/'
	}, function(result){
		$scope.subs = result;
	}, function(err){
		$rootScope.error = err;
	});

}]);

billingApp.controller('PlanController', ['$rootScope', '$routeParams', '$scope', 'api', function($rootScope, $routeParams, $scope, api){
	
	var id = $routeParams.id;

	$rootScope.title = "Plan";

	$scope.plan = {
		addOns: []
	};
	$scope.addOns = [];
	$scope.newAddon = {
		index: '0',
		quantity: 1
	};

	if(id !== 'new'){
		api.request({
			url: '/plans/get/'+id
		}, function(result){
			console.log(result);
			if(result.result.attributes) {
				result.result.attributes = JSON.stringify(result.result.attributes);
			}
			$scope.plan = result.result;
		}, function(err){
			$rootScope.error = err;
		});
	}

	getAddons();

	$scope.addAddon = function(){
		var newAddon = $scope.addOns[$scope.newAddon.index];
		console.log('addAddon: ', newAddon);
		newAddon.quantity = $scope.newAddon.quantity;
		$scope.plan.addOns.push(newAddon);
	};

	$scope.removeAddon = function(index){
		$scope.plan.addOns.splice(index, 1);
	};
	
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

	function getAddons(){
		api.request({
			url: '/addons/'
		}, function(result){
			$scope.addOns = result;
		}, function(err){
			$rootScope.error = err;
		});
	}

}]);

billingApp.controller('AddonController', ['$rootScope', '$routeParams', '$location', '$scope', 'api', function($rootScope, $routeParams, $location, $scope, api){
	
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
			$location.path('/addons/new');
		}, function(err){
			$rootScope.error = err;
		});
	};

}]);

billingApp.controller('DiscountController', ['$rootScope', '$routeParams', '$location', '$scope', 'api', function($rootScope, $routeParams, $location, $scope, api){
	
	var id = $routeParams.id;
	$rootScope.title = "Discount";

	$scope.discount = {};

	if(id !== 'new'){
		api.request({
			url: '/discounts/get/'+id
		}, function(result){
			$scope.discount = result.result;
		}, function(err){
			$rootScope.error = err;
		});
	}
	
	$scope.set = function(){
		console.log($scope.discount);
		
		api.request({
			url: '/discounts/'+(id === 'new' ? 'add' : 'update/'+id),
			params: $scope.discount
		}, function(result){
			console.log(result);
		}, function(err){
			$rootScope.error = err;
		});
	};

	$scope.delete = function(){
		api.request({
			url: '/discounts/delete/'+id,
			params: $scope.discount
		}, function(result){
			console.log(result);
			$location.path('/discounts/new');
		}, function(err){
			$rootScope.error = err;
		});
	};

}]);

billingApp.controller('CouponController', ['$rootScope', '$routeParams', '$location', '$scope', 'api', function($rootScope, $routeParams, $location, $scope, api){
	
	var id = $routeParams.id;
	$rootScope.title = "Coupon";

	$scope.coupon = {};
	
	$scope.set = function(){
		console.log($scope.coupon);
		
		if($scope.coupon.expires)
			$scope.coupon.expires = new Date($scope.coupon.expires).now();

		api.request({
			url: '/coupons/'+(id === 'new' ? 'add' : 'update/'+id),
			params: $scope.coupon
		}, function(result){
			console.log(result);
		}, function(err){
			$rootScope.error = err;
		});
	};

	$scope.delete = function(){
		api.request({
			url: '/coupons/delete/'+id,
			params: $scope.coupon
		}, function(result){
			console.log(result);
			$location.path('/coupons/new');
		}, function(err){
			$rootScope.error = err;
		});
	};

	init();

	function init() {
		if(id !== 'new'){
			api.request({
				url: '/coupons/get/'+id
			}, function(result){
				$scope.coupon = result.result;
			}, function(err){
				$rootScope.error = err;
			});
		}
	}

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

billingApp.controller('InvoiceController', ['$rootScope', '$routeParams', '$location', '$scope', 'api', function($rootScope, $routeParams, $location, $scope, api){
	
	var id = $routeParams.id;
	$rootScope.title = "Invoice";

	$scope.invoice = {};

	if(id !== 'new'){
		api.request({
			url: '/invoices/get/'+id
		}, function(result){
			$scope.invoice = result.result;
		}, function(err){
			$rootScope.error = err;
		});
	}
	
	$scope.set = function(){
		console.log($scope.invoice);
		
		api.request({
			url: '/invoices/'+(id === 'new' ? 'add' : 'update/'+id),
			params: $scope.invoice
		}, function(result){
			console.log(result);
		}, function(err){
			$rootScope.error = err;
		});
	};

	$scope.delete = function(){
		api.request({
			url: '/invoices/delete/'+id,
			params: $scope.invoice
		}, function(result){
			console.log(result);
			$location.path('/invoices/new');
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
				// $localStorage.token = res.token;
				$location.path('/login');
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
