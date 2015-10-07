var pm2 = require('pm2');
 
pm2.connect(function() {
  pm2.start({
	  name: "billing-app",
	  watch: true,
    script : 'server.js',         // Script to be run 
    max_memory_restart : '100M',   // Optional: Restart your app if it reaches 100Mo 
    env: {
		"DEBUG" : "jobs, billing"
    }
  }, function (err, apps) {
    pm2.disconnect();
  });
});