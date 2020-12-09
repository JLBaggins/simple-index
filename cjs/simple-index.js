'use strict'

let CONFIG

/* this seems an odd hack to allow the package to require config with and without webpack. consider better code */
try {
  CONFIG = require('simple-index.config')
} catch (e) {
  try {
    const configPath = '../../../'
    CONFIG = require(configPath + 'simple-index.config')
  } catch (e) {
    try {
      const configPath = './'
      CONFIG = require(configPath + 'simple-index.config')
    } catch (e) {
      CONFIG = {
        schema: {
          simpleDB: {
            objStore: {
              keyPath: 'key'
            }
          }
        },
        delete: [],
        mode: 'production',
        simple_on: true
      }
    }
  }
}

if (!CONFIG.mode) {
  CONFIG.mode = 'production'
};

if (typeof CONFIG.simple_on === 'undefined' || CONFIG.simple_on) {
  CONFIG.schema.simpleDB = {
    objStore: {
      keyPath: 'key'
    }
  }
}

// TODO: this function will provide a more reliable and less intrusive way of removing old databases.
function configureCache () {
  if (CONFIG.delete) {
    for (const database in CONFIG.delete) {
      try {
        window.indexedDB.deleteDatabase(database)
      } catch (e) {};
    };
  };

  if (!CONFIG.simple_on) {
    try {
      window.indexedDB.deleteDatabase('simpleDB')
    } catch (e) {};
  };

// Many browsers currently don't support databases, see https://bugzilla.mozilla.org/show_bug.cgi?id=934640
//   const promise = window.indexedDB.databases();
//   console.log(promise);
//   promise.then(databases => {
//   for (let database in databases) {
//     if (typeof CONFIG.schema[database] === 'undefined') {
//       window.indexedDB.deleteDatabase(database);
//       };
//     };
//   });
};

function errorWarning (message) {
  if (CONFIG.mode === 'development') {
    if (typeof console !== 'undefined') {
      console.error(message)
    };
  };
};

function databaseOnError (event) {
  errorWarning(event)
  errorWarning('simple-indexedDB database error, indexedDB error: ' + event.target.errorCode)
};

function getCache (dbName, callback) {
  const cache = window.indexedDB.open('current_schema', 1)

  cache.onerror = function (event) {
    databaseOnError(event)
  }

  cache.onupgradeneeded = function (event) {
    const cacheDB = event.target.result

    cacheDB.onerror = function (event) {
      databaseOnError(event)
    }

    if (event.oldVersion < 1) {
      const objectStore = cacheDB.createObjectStore('cache', { keyPath: 'name' })

      objectStore.transaction.oncomplete = function (event) {
        const cacheObjectStore = cacheDB.transaction('cache', 'readwrite').objectStore('cache')
        for (const dbOBJName in CONFIG.schema) {
          const newDBOBJCache = {
            version: 0,
            name: dbOBJName,
            current: {},
            previous: {}
          }
          cacheObjectStore.add(newDBOBJCache)
        };
      }
    };
  }

  cache.onsuccess = function (event) {
    const cacheDB = event.target.result

    cacheDB.onerror = function (event) {
      databaseOnError(event)
    }

    const cacheTransaction = cacheDB.transaction('cache', 'readwrite')

    cacheTransaction.onerror = function (event) {
      databaseOnError(event)
    }

    const cacheObjectStore = cacheTransaction.objectStore('cache')

    cacheObjectStore.onerror = function (event) {
      databaseOnError(event)
    }

    const cacheObjectStoreRequest = cacheObjectStore.get(dbName)

    cacheObjectStoreRequest.onerror = function (event) {
      databaseOnError(event)
    }

    cacheObjectStoreRequest.onsuccess = function (event) {
      let cachedDBOBJ = cacheObjectStoreRequest.result
      if (!cachedDBOBJ) {
        cachedDBOBJ = {
          version: 0,
          name: dbName,
          current: {},
          previous: {}
        }
        cacheObjectStore.put(cachedDBOBJ)
        window.indexedDB.deleteDatabase(dbName)
      };
      if (JSON.stringify(cachedDBOBJ.current) !== JSON.stringify(CONFIG.schema[dbName])) {
        cachedDBOBJ.version += 1
        cachedDBOBJ.previous = cachedDBOBJ.current
        cachedDBOBJ.current = CONFIG.schema[dbName]
        cacheObjectStore.put(cachedDBOBJ)
      };
      callback(cachedDBOBJ)
    }
  }
};

function openDatabase (cacheDB, callback) {
  const request = window.indexedDB.open(cacheDB.name, cacheDB.version)

  request.onerror = function (event) {
    databaseOnError(event)
  }

  request.onupgradeneeded = function (event) {
    const db = event.target.result

    db.onerror = function (event) {
      databaseOnError(event)
    }

    if (event.oldVersion < cacheDB.version) {
      for (const objStore in cacheDB.previous) {
        if (typeof cacheDB.current[objStore] === 'undefined') {
          try {
            db.deleteObjectStore(objStore)
          } catch (e) {
            errorWarning('no objectStore ' + objStore + ' in database ' + cacheDB.name)
          }
        } else {
          for (const index in cacheDB.previous[objStore].indexes) {
            if (typeof cacheDB.previous[objStore].indexes[index] === 'undefined') {
              try {
                const objectStore = db.transaction(objStore, 'readwrite').objectStore(objStore)
                objectStore.deleteIndex(index)
              } catch (e) {
                errorWarning('no index ' + index + ' in objectStore ' + objStore)
              }
            };
          };
        };
      };

      for (const objStore in cacheDB.current) {
        const objectStore = db.createObjectStore(objStore, { keyPath: cacheDB.current[objStore].keyPath })
        try {
          objectStore.transaction.oncomplete = function (event) {
            if (cacheDB.current[objStore].indexes) {
              for (const objStoreIndex in cacheDB.current[objStore].indexes) {
                objectStore.createIndex(objStoreIndex, objStoreIndex, { unique: cacheDB.current[objStore].indexes[objStoreIndex] })
              };
            };
          }
        } catch (e) {
          errorWarning('objectstore ' + objStore + ' already in database ' + cacheDB.name)
          for (const index in cacheDB.current[objStore].indexes) {
            try {
              for (const objStoreIndex in cacheDB.current[objStore].indexes) {
                objectStore.createIndex(objStoreIndex, objStoreIndex, { unique: cacheDB.current[objStore].indexes[objStoreIndex] })
              };
            } catch (e) {
              errorWarning(index + ' index already exists in objectStore ' + objStore)
            }
          };
        }
      };
    };
  }

  request.onsuccess = function (event) {
    const db = event.target.result
    db.onerror = function (event) {
      databaseOnError(event)
    }
    callback(db)
  }
};

function openTransaction (db, objStoreName, callback) {
  const transaction = db.transaction(objStoreName, 'readwrite')

  transaction.onerror = function (event) {
    databaseOnError(event)
  }

  callback(transaction)
};

function openObjectStore (transaction, objStoreName, callback) {
  const objectStore = transaction.objectStore(objStoreName)

  objectStore.onerror = function (event) {
    databaseOnError(event)
  }

  callback(objectStore)
};

function openDBRequest (objstore, dbRequest, arg, callback) {
  try {
    const request = objstore[dbRequest](arg)

    request.onerror = function (event) {
      errorWarning(dbRequest + ' could not be executed with args: ' + arg)
      callback(null, null)
    }

    request.onsuccess = function (event) {
      callback(null, request.result)
    }
  } catch (e) {
    errorWarning('No such request: ' + dbRequest)
    errorWarning('Perhaps check either config file or arg for mistakes.')
    callback(null, null)
  };
};

function beginTransaction (arg, objStoreName, cachedDB, dbRequest, callback) {
  openDatabase(cachedDB, (db) => {
    openTransaction(db, objStoreName, (transaction) => {
      openObjectStore(transaction, objStoreName, (objstore) => {
        openDBRequest(objstore, dbRequest, arg, (err, response) => {
          callback(err, response)
        })
      })
    })
  })
};

function makeRequest (arg, objStoreName, dbName, dbRequest, callback) {
  getCache(dbName, (cachedDB) => {
    beginTransaction(arg, objStoreName, cachedDB, dbRequest, (err, response) => {
      callback(err, response)
    })
  })
};

function commitObject (data, objStoreName, dbName, callback) {
  makeRequest(data, objStoreName, dbName, 'put', (err, response) => {
    callback(err, response)
  })
};

function getObject (key, objStoreName, dbName, callback) {
  makeRequest(key, objStoreName, dbName, 'get', (err, response) => {
    callback(err, response)
  })
};

function removeObject (key, objStoreName, dbName, callback) {
  makeRequest(key, objStoreName, dbName, 'delete', (err, success) => {
    callback(err, success)
  })
}

// function getObjectStore (objStoreName, dbName, callback) {
//   makeRequest(null, objStoreName, dbName, 'getAll', (err, response) => {
//     callback(err, response)
//   })
// };

/* this function can return hugh quantitiy of data, offer cursor function */
// const getObjectStoreCursor = function (objStoreName, dbName, callback) {
//   getObjectStore(objStoreName, objStoreName, dbName, (err, arrayGen) => {
//     callback(err, arrayGen)
//   })
// }

/* put expects first arg to be array of data or single data, a callback, and an optional objectstore and dbname */
exports.put = function (obj, objectStoreName = 'objStore', dBName = 'simpleDB', callback) {
  if (typeof obj !== 'object') {
    callback('not an object')
  };
  if (obj.objectstore) {
    objectStoreName = obj.objectstore
    dBName = obj.dbname
    callback = arguments[1]
  } else if (arguments.length === 3) {
    callback = arguments[1]
    objectStoreName = 'objStore'
  };
  commitObject(obj, objectStoreName, dBName, (err, success) => {
    callback(err, success)
  })
}

exports.get = function (key, objectStoreName = 'objStore', dBName = 'simpleDB', callback) {
  if (key.objectstore) {
    objectStoreName = key.objectstore
    dBName = key.dbname
    callback = arguments[1]
  } else if (arguments.length === 3) {
    callback = arguments[1]
    objectStoreName = 'objStore'
  };
  getObject(key, objectStoreName, dBName, (err, object) => {
    callback(err, object)
  })
}

exports.remove = function (key, objStoreName, dbName, callback) {
  removeObject(key, objStoreName, dbName, (err, success) => {
    callback(err, success)
  })
}

configureCache()
