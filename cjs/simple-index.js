"use strict";


let config;

/* this seems an odd hack to allow the package to require config with and without webpack. consider better code */
try{
	config = require('simple-index.config');	
}
catch(e) {
	try {
		let config_path = '../../../'
		config = require(config_path + 'simple-index.config');
	}
	catch(e) {
		try {
			let config_path = './'
			config = require(config_path + 'simple-index.config');
		}
		catch(e) {
			error("simple-index.config.js not found (ignore this error if not using a config file). If using a config file, try placing it in the root folder of the app. If this error still occurs, try placing it in the root folder of the simple-index module with the index.js file. If using webpack, include a resolve alias in the webpack.config.js file.");
		}
	}
}
						
const simpleDB = {
	schema: {
		'simpleDB' : {
			'objStore' : {
				keyPath : 'key'
			},
		}
	},
	mode : 'production',
	simple_on : true
};

let mode;
if (config.mode) {
 	mode = config.mode;
} else {
	mode = 'production';
};

let simple_on = true;
if (config.simple_on === false)  {
	simple_on = false
}
	
if (simple_on) {
	if (!config) {
		config = simpleDB;
	} else {
		config.schema['simpleDB'] = simpleDB.schema['simpleDB']
	};
}


function error(message) {
	if (mode === "development") {
		console.error(message);
	};
};


function databaseOnError(event) {
	error(event);
	error('simple-indexedDB database error, indexedDB error: ' + event.target.errorCode);
};


function getCache(db_name, callback) {
	
	const cache = window.indexedDB.open('current_schema', 1);
		
	cache.onerror = function(event) {
		databaseOnError(event);
	};

	cache.onupgradeneeded = function(event) {
		const cache_db = event.target.result;
		
		cache_db.onerror = function(event) {
			databaseOnError(event);
		}; 
		
		if (event.oldVersion < 1) {
			const objectStore = cache_db.createObjectStore("cache" , { keyPath: "name"});
			
			objectStore.transaction.oncomplete = function(event) {
				const cacheObjectStore = cache_db.transaction("cache", "readwrite").objectStore("cache");
				for (let db_obj_name in config.schema) {
					let new_db_obj_cache = {
						version: 0,
						name: db_obj_name,
						current: {},
						previous: {}
					};
		      cacheObjectStore.add(new_db_obj_cache);					
				};
		  };
		};
	};
	
	cache.onsuccess = function(event) {
		const cache_db = event.target.result;
		
		cache_db.onerror = function(event) {
			databaseOnError(event);
		};
		
		const cache_transaction = cache_db.transaction("cache", "readwrite");
		
		cache_transaction.onerror = function(event) {
			databaseOnError(event);
		};
		
		const cache_objectStore = cache_transaction.objectStore("cache");
		
		cache_objectStore.onerror = function(event) {
			databaseOnError(event);
		};
	
		const cache_objStore_request = cache_objectStore.get(db_name);
	
		cache_objStore_request.onerror = function(event) {
			databaseOnError(event);
		};
	
		cache_objStore_request.onsuccess = function(event) {
			let cached_db_obj = cache_objStore_request.result;
			if (!cached_db_obj) {
				cached_db_obj = {
					version: 0,
					name: db_name,
					current: {},
					previous: {}
				};
				cache_objectStore.put(cached_db_obj);
				window.indexedDB.deleteDatabase(db_name);
			}
			if (cached_db_obj.current != config.schema[db_name]) {
				cached_db_obj.version += 1;
				cached_db_obj.previous = cached_db_obj.current;
				cached_db_obj.current = config.schema[db_name];
				cache_objectStore.put(cached_db_obj);
			};
			callback(cached_db_obj);
		};
	};
};


function openDatabase(cache_db, callback) {
			
	const request = window.indexedDB.open(cache_db.name, cache_db.version);
	
	request.onerror = function(event) {
		databaseOnError(event);
	};

 	request.onupgradeneeded = function(event) {
		var db = event.target.result;

		db.onerror = function(event) {
			databaseOnError(event);
		};

		if (event.oldVersion < cache_db.version) {
			
			for (let objStore in cache_db.previous) {
				if (typeof cache_db.current[objStore] === 'undefined') {
					try {
						db.deleteObjectStore(objStore);					
					}
					catch(e) {
						error("no objectStore " + objStore + " in database " + cache_db.name);
					}	
				};
			}; 
			
			for (let objStore in cache_db.current) {
				try{
					let objectStore = db.createObjectStore(objStore, { keyPath: cache_db.current[objStore].keyPath});
					if (cache_db.current[objStore].indexes) {
						for (let objStore_index in cache_db.current[objStore].indexes) {
							objectStore.createIndex(objStore_index, objStore_index, {unique: cache_db.current[objStore].indexes[objStore_index]});
						};
					};
				}
				catch(e) {
					error("objectstore " + objStore + " already in database " + cache_db.name);
				}	
			};
		};
 	};

	request.onsuccess = function(event) {
		var db = event.target.result;
		db.onerror = function(event) {
			databaseOnError(event);
		};
		callback(db);
 	};
};


function openTransaction(db, objstore_name, callback) {
	const transaction = db.transaction(objstore_name, "readwrite");

	transaction.onerror = function(event) {
		databaseOnError(event)
	} 

	callback(transaction);
};


function openObjectStore(transaction, objstore_name, callback) {
	const objectStore = transaction.objectStore(objstore_name);

	objectStore.onerror = function(event) {
		databaseOnError(event)
	} 

	callback(objectStore);
};


function openDBRequest(objstore, db_request, arg, callback) {
	try {
		console.log(objstore);
		const request = objstore[db_request](arg);

		request.onerror = function(event) {
			error(db_request + " could not be executed with args: " + arg);
			callback(null, null);
		};

		request.onsuccess = function(event) {
			callback(null, request.result);
		};

	}
	catch(e) {
		error("No such request: " + db_request);
		callback(null, null);
	};
}; 


function beginTransaction(arg, objstore_name, cached_db, db_request, callback) {
	openDatabase(cached_db, (db) => {
		openTransaction(db, objstore_name, (transaction) => {
			openObjectStore(transaction, objstore_name, (objstore) => {
				openDBRequest(objstore, db_request, arg, (err, response) => {
					callback(err, response);
				});
			});
	 	});
	});
};
	

function makeRequest(arg, objstore_name, db_name, db_request, callback) {
	getCache(db_name, (cached_db) => {
		beginTransaction(arg, objstore_name, cached_db, db_request, (err, response) => {
			callback(err, response)
		});
	});
};
	

function commitObject(data, objstore_name, db_name, callback) {
	makeRequest(data, objstore_name, db_name, 'put', (err, response) => {
		callback(err, response);
	});
};


function getObject(key, objstore_name, db_name, callback){
	makeRequest(key, objstore_name, db_name, 'get', (err, response) => {
		callback(err, response);
	});
};


function getObjectStore(objstore_name, db_name, callback) {
	makeRequest(null, objstore_name, db_name, 'getAll', (err, response) => {
		callback(err, response);
	});
};


function removeObject(key, objstore_name, db_name, callback) {
	makeRequest(key, objstore_name, db_name, "delete", (err, success) => {
		callback(err, success)
	})
}


/* consider function rewrite*/
exports.get = function(key, objectStoreName, dBName, callback) {
	getObject(key, objectStoreName, dBName, (err, object) => {
		callback(err, object);
	});
};
		

/* this function can return hugh quantitiy of data, offer cursor function */
exports.getObjectStore = function(objstore_name, db_name, callback) {
	getObjectStore(objstore_name, objstore_name, db_name, (err, object) => {
		callback(err, object);
	});
};
		
		
/*put expects first arg to be array of data or single data, a callback, and an optional objectstore and dbname */
const put = exports.put = function() {
	let objectStoreName, dBName, callback, obj = arguments[0];
	if (arguments.length == 4) {
		objectStoreName = arguments[1];
		dBName = arguments[2];
		callback = arguments[3];
	} else if (obj.objectstore) {
		objectStoreName = obj.objectstore;
		dBName = obj.dbname;		
		callback = arguments[1];
	} else {
		objectStoreName = 'objStore';
		dBName = 'simpleDB';
		callback = arguments[1];
	}
	if (typeof obj === 'array') {
		let success;
		for (let to_store of obj) {
			commitObject(to_store, objectStoreName, dBName, (err, success) => {
				if (err) {
					callback(err, success);
				}
			})	
		}
		callback(null, success);
	} else {
		commitObject(obj, objectStoreName, dBName, (err, success) => {
			callback(err, success);
	 	})
	}
};


exports.remove = function(key, objstore_name, db_name, callback) {
	removeObject(key, objstore_name, db_name, (err, success) => {
		callback(err, success);
	});
};


exports.delDatabase = function(name) {
	try {
		window.indexedDB.delete(name);		
	}
	catch(e) {
		error("No database with name: " + name);
	}
};

