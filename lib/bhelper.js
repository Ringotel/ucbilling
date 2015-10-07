module.exports = {
    getPoolSize: function(arrayOrString) {
        var poolsize = 0;

        if(Array.isArray(arrayOrString)){
            arrayOrString.forEach(function(obj, indx, array){
                poolsize += obj.poolsize;
            });
        } else {
            arrayOrString
            .split(',')
            .map(function(str){
                return str.split('-');
            })
            .forEach(function(array){
                poolsize += parseInt(array[1] ? (array[1] - array[0]+1) : 1, 10);
            });
        }
            
        return poolsize;
    },
    poolArrayToString: function(array){
        var str = '';
        array.forEach(function(obj, indx, array){
            if(indx > 0) str += ',';
            str += obj.firstnumber;
            if(obj.poolsize > 1) str += ('-' + (obj.firstnumber+obj.poolsize-1));
        });
        return str;
    },
    poolStringToObject: function(string){
        var extensions = [];

        string
        .split(',')
        .map(function(str){
            return str.split('-');
        })
        .forEach(function(array){
            extensions.push({
                firstnumber: parseInt(array[0], 10),
                poolsize: parseInt(array[1] ? (array[1] - array[0]+1) : 1, 10)
            });
        });
        return extensions;
    }
};