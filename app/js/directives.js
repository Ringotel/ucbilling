billingApp.directive('sideMenu', function(){
    return {
        restrict: 'AE',
        transclude: true,
        controller: 'SidebarController',
        templateUrl: '/partials/sidebar.html'
    };
});

billingApp.directive('topMenu', function(){
    return {
        restrict: 'AE',
        transclude: true,
        controller: 'TopmenuController',
        templateUrl: '/partials/topmenu.html'
    };
});