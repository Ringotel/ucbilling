 var Subscriptions = require('./subscriptions');
 var ctiRequest = require('./cti').request;
 var async = require('async');

 module.exports = {

	getBranch: function(branch, cb){

		async.waterfall([

			function (cb){
				var requestParams = {
					server: branch.sid,
					data: {
						method: 'getBranchOptions',
						params: {
							oid: branch.oid
						}
					},
				};
				ctiRequest(requestParams, function (err, result){
					if(err) {
						cb(err);
					} else {
						cb(null, result);
					}
				});
			}], function (err, result){
				if(err){
					cb(err);
				} else {
					cb(null, result);
				}
			}
		);
	},

	getBranches: function(req, res, next){

		var branches = [];

		Subscriptions.getAll({customerId: req.decoded.id}, function (err, subs){
			if(err) {
				next(new Error(err));
			} else {
				async.each(subs, function (sub, cb1){

					async.waterfall([
						function (cb2){
							this.getBranch(sub.branch, function (err, branch){
								if(err) {
									cb2(err);
								} else {
									cb2(null, branch);
								}
							});
						}], function (err, branch){
							if(err){
								cb1(err);
							} else {
								//extend branch object with subscription params
								branch.balance = sub.balance;
								branch.status = sub.status;
								branch.createAt = sub.createAt;
								//push returned branch object to the final array of branches
								branches.push(branch);
								cb1();
							}
						}
					);

				}, function (err){
					if(err){
						next(new Error(err));
					} else {
						//all branches are ready, now responce to the request with the array of branches
						res.json({
							success: true,
							result: branches
						});
					}
				});
			}
		});
	},

	createBranch: function(req, res, next){

		var params = req.body;

		async.waterfall([

			function (cb){
				var requestParams = {
					server: params.server,
					data: {
						method: 'createBranch',
						params: params.params
					}
				};
				//returns branch object
				ctiRequest(requestParams, function (err, result){
					if(err) {
						cb(err);
					} else {
						cb(null, result.oid);
					}
				});
			},
			function (branchId, cb){
				params.customerId = req.decoded.id;
				params.branchId = branchId;
				Subscriptions.create(params, function (err, sub){
					if(err){
						cb(err);
					} else {
						cb(null, params.params.oid);
					}
				});
			}], function (err, branchId){
				if(err){
					next(new Error(err));
				} else {
					res.json({
						success: true,
						result: branchId
					});
				}
			}
		);

	},

	updateBranch: function(req, res, next){

		var params = req.body;

		async.waterfall([

			function (cb){
				var requestParams = {
					server: params.server,
					data: {
						method: 'setBranchOptions',
						params: params.params
					}
				};
				//returns branch object
				ctiRequest(requestParams, function (err, result){
					if(err) {
						cb(err);
					} else {
						cb(null, result);
					}
				});
			},
			function (cb){
				Subscriptions.update({'branch.oid': params.params.oid}, params, function (err, newSub){
					if(err){
						cb(err);
					} else {
						cb(null, newSub);
					}
				});
			}], function (err, newSub){
				if(err){
					next(new Error(err));
				} else {
					res.json({
						success: true,
						result: newSub
					});
				}
			}
		);

	},

	setBranchState: function(req, res, next){

		var params = req.body;

		async.waterfall([
			function (cb){
				var requestParams = {
					server: params.server,
					data: {
						method: 'setBranchState',
						params: params.params
					}
				};
				//returns branch object
				ctiRequest(requestParams, function (err, result){
					if(err) {
						cb(err);
					} else {
						cb(null);
					}
				});
			},
			function (cb){
				var state = params.params.enabled ? 'active' : 'paused';
				params.state = state;
				Subscriptions.updateState({'branch.oid': params.params.oid}, params, function (err){
					if(err){
						cb(err);
					} else {
						cb(null);
					}
				});
			}], function (err){
				if(err){
					next(new Error(err));
				} else {
					res.json({
						success: true
					});
				}
			}
		);

	},

	deleteBranch: function(req, res, next){

		var params = req.body;

		async.waterfall([
			function (cb){
				var requestParams = {
					server: params.server,
					data: {
						method: 'deleteBranch',
						params: params.params
					}
				};
				//returns branch object
				ctiRequest(requestParams, function (err, result){
					if(err) {
						cb(err);
					} else {
						cb(null);
					}
				});
			},
			function (cb){
				Subscriptions.cancel({'branch.oid': params.params.oid}, function (err){
					if(err){
						cb(err);
					} else {
						cb(null);
					}
				});
			}], function (err){
				if(err) {
					next(new Error(err));
				} else {
					res.json({
						success: true
					});
				}
			}
		);
	}
 };