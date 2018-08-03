var Plans = require('../models/plans');

module.exports = {
	get, 
	add, 
	update, 
	deleteById
};

function getAll(params, projection){
	var query = Plans.find(params);
	if(projection) query.select(projection);
	return query.exec();
}

function get(params, projection, callback){
	var query = Plans.findOne(params);
	if(projection) query.select(projection);
	query.exec(function (err, result){
		if(err) return callback(err);
		callback(null, result);
	});
}

function add(params){
	if(params.attributes) {
		params.attributes = JSON.parse(params.attributes);
	}

	var newPlan = new Plans(params);

	return newPlan.save();
}

function update(query, params){
	if(params.attributes) {
		params.attributes = JSON.parse(params.attributes);
	}

	return Plans.update(query, params)
}

function deleteById(params){
	return Plans.remove(params);
}
