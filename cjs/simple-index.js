"use strict";

// var CONFIG;
//
/* this seems an odd hack to allow the package to require config with and without webpack. consider better code */
// try{
// 	CONFIG = require('simple-index.config');
// }
// catch(e) {
// 	try {
// 		let config_path = '../../../'
// 		CONFIG = require(config_path + 'simple-index.config');
// 	}
// 	catch(e) {
// 		try {
// 			let config_path = './'
// 			CONFIG = require(config_path + 'simple-index.config');
// 		}
// 		catch(e) {
// 			console.error("simple-index.config.js not found (ignore this error if not using a config file). If using a config file, try placing it in the root folder of the app. If this error still occurs, try placing it in the root folder of the simple-index module with the index.js file. If using webpack, include a resolve alias in the webpack.config.js file.");
// 		}
// 	}
// }
//
// console.log(CONFIG);

const CONFIG = {
	schema: {
		'simpleDB' : {
			'objStore' : {
				keyPath : 'key'
			},
		}
	},
	delete: [],
	mode : 'development',
	simple_on : true
};

if (CONFIG.mode) {
	let mode = "development";
 	mode = CONFIG.mode;
// } else {
// 	mode = 'production';
};

let simple_on = true;
if (CONFIG.simple_on === false)  {
	simple_on = false
}

// if (simple_on) {
// 	if (!CONFIG) {
// 		CONFIG = simpleDB;
// 	} else {
// 		CONFIG.schema['simpleDB'] = simpleDB.schema['simpleDB']
// 	};
// }

// TODO: this function will provide a more reliable and less intrusive way of removing old databases.
function configureCache() {

	if(CONFIG.delete) {
		for(let database in CONFIG.delete) {
			try{
				window.indexedDB.deleteDatabase(database);
			}
			catch(e){};
		};
	};

	if(!simple_on) {
		try{
			window.indexedDB.deleteDatabase("simpleDB")
		}
		catch(e){};
	};


// Many browsers currently don't support databases, see https://bugzilla.mozilla.org/show_bug.cgi?id=934640
	// const promise = window.indexedDB.databases();
	// console.log(promise);
	// promise.then(databases => {
	// 	for (let database in databases) {
	// 		if (typeof CONFIG.schema[database] === 'undefined') {
	// 			window.indexedDB.deleteDatabase(database);
	// 		};
	// 	};
	// });
};


			
function errorWarning(message) {
	if (mode === "development") {
		if(typeof console !== "undefined") {
			console.error(message);
		}
	};
};


function databaseOnError(event) {
	errorWarning(event);
	errorWarning('simple-indexedDB database error, indexedDB error: ' + event.target.errorCode);
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
				for (let db_obj_name in CONFIG.schema) {
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
			};
			if (JSON.stringify(cached_db_obj.current) != JSON.stringify(CONFIG.schema[db_name])) {
				cached_db_obj.version += 1;
				cached_db_obj.previous = cached_db_obj.current;
				cached_db_obj.current = CONFIG.schema[db_name];
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
						errorWarning("no objectStore " + objStore + " in database " + cache_db.name);
					}
				} else {
					for (let index in cache_db.previous[objStore].indexes) {
						if (typeof cache_db.previous[objStore].indexes[index] === 'undefined') {
							try {
								const objectStore = db.transaction(objStore, "readwrite").objectStore(objStore);
								objectStore.deleteIndex(index);
							}
							catch(e) {
								errorWarning("no index " + index + " in objectStore " + objStore);
							}
						};
					};
				};
			};


			for (let objStore in cache_db.current) {
				try{
					let objectStore = db.createObjectStore(objStore, { keyPath: cache_db.current[objStore].keyPath});
					objectStore.transaction.oncomplete = function(event) {
						if (cache_db.current[objStore].indexes) {
							for (let objStore_index in cache_db.current[objStore].indexes) {
								objectStore.createIndex(objStore_index, objStore_index, {unique: cache_db.current[objStore].indexes[objStore_index]});
							};
						};
					};
				}
				catch(e) {
					errorWarning("objectstore " + objStore + " already in database " + cache_db.name);
					for (let index in cache_db.current[objStore].indexes) {
						try {
							objectStore.createIndex(objStore_index, objStore_index, {unique: cache_db.current[objStore].indexes[objStore_index]});
						}
						catch(e) {
							errorWarning(index + " index already exists in objectStore " + objStore);
						}
					};
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
		databaseOnError(event);
	};

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
		const request = objstore[db_request](arg);

		request.onerror = function(event) {
			errorWarning(db_request + " could not be executed with args: " + arg);
			callback(null, null);
		};

		request.onsuccess = function(event) {
			callback(null, request.result);
		};

	}
	catch(e) {
		errorWarning("No such request: " + db_request);
		errorWarning("Perhaps check config file for mistakes.")
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


function removeObject(key, objstore_name, db_name, callback) {
	makeRequest(key, objstore_name, db_name, "delete", (err, success) => {
		callback(err, success)
	})
}


function getObjectStore(objstore_name, db_name, callback) {
	makeRequest(null, objstore_name, db_name, 'getAll', (err, response) => {
		callback(err, response);
	});
};

/* this function can return hugh quantitiy of data, offer cursor function */
const getObjectStoreCursor = function(objstore_name, db_name, callback) {
	getObjectStore(objstore_name, objstore_name, db_name, (err, arrayGen) => {
		callback(err, arrayGen);
	});
};


/*put expects first arg to be array of data or single data, a callback, and an optional objectstore and dbname */
const put = exports.put = function() {
	let objectStoreName, dBName, callback;
	let obj = arguments[0];
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
	};
	if (typeof obj === 'array') {
		let success;
		for (let to_store of obj) {
			commitObject(to_store, objectStoreName, dBName, (err, success) => {
				if (err) {
					return callback(err, success);
				};
			});
		};
		callback(null, success);
	} else {
		commitObject(obj, objectStoreName, dBName, (err, success) => {
			callback(err, success);
	 	});
	};
};

const get = exports.get = function() {
	let objectStoreName, dBName, callback;
	let key = arguments[0];
	if (arguments.length == 4) {
		objectStoreName = arguments[1];
		dBName = arguments[2];
		callback = arguments[3];
	} else if (key.objectstore) {
		objectStoreName = key.objectstore;
		dBName = key.dbname;
		callback = arguments[1];
	} else {
		objectStoreName = 'objStore';
		dBName = 'simpleDB';
		callback = arguments[1];
	};
	if (typeof key === objectStoreName) {
		let success;
		for (let to_get of key) {
			getObject(to_get, objectStoreName, dBName, (err, object) => {
				if (err) {
					callback(err, null);
				};
				callback(err, object);
			});
		};
	} else {
		getObject(key, objectStoreName, dBName, (err, object) => {
			callback(err, object);
		});
	};
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
		errorWarning("No database with name: " + name);
	}
};


configureCache();
