# Simple-Index
An indexedDB wrapper for simplified client side object storage.

simple-index handles the messy verbiage of updating database versions and provides straight forward functions needed to interact with the database(s).

Once installed, simple-index can be used client side without any configuration.

Example:
```javascript
import simpleIndex from "simple-index";

const obj_to_store = {
	title: "foo",
	author: "bar",
	key: "book: foo" // this attribute is necessary if not using a config file
}

simpleIndex.put(obj_to_store, (err, success) => {
	if(err) {
		console.error(err);
	} else if (success) {
		alert("Book saved!");
	} else {
		alert("Unable to save book.");
	};
});


simpleIndex.get("book: foo", (err, obj) => {
	if(err) {
		console.error(err);
	} else {
		// do something with obj;
	};
});
```

Simple-index handles all the excessive verbiage of upgrading database versions and provides simple functions to store, access, update and remove data from the indexedDB. It utilizes an optional config file for describing and customizing database(s) structures.


## Functions:

### put
*Syntax:*
```
put(object, [objectStoreName, databaseName,] callback(err, success))
```

*Parameters:*
```
`object` - object to be put
`objectStoreName` - the name of the objectStore to use
`databaseName` - the name of the database to use
`callback` - a callback function which expects an err string and success boolean
```

There are three options for using the `<put>` function. 
Without a config file or if opting for the included database, simply call <put> without the optional objectStoreName or databaseName, including a unique key property with the object. Note: if `<put>` finds an object in the objectstore with the same 'key' it will update that object rather than store another. 

An example:
```javascript
const object_to_store = {
	key: "favorites", // this property is necessary
	color: "teal",
	pets: "chihuahua",
	flower: "daisy"
};

simpleIndex.put(object_to_store, (err, success) => {
	if(err) {
		console.error(err);
	};
	if(success) {
		alert("Saved your favorites!");
	};
});
```

Using a database from the config file requires the objectStoreName name and databaseName name arguments to be supplied. They can either be included as arguments in the function call:
```javascript
const object_to_store = {
	key: "favorites",
	color: "teal",
	pets: "chihuahua",
	flower: "daisy"
};

const objectStoreName = "preferences";

const databaseName = "user";

simpleIndex.put(object_to_store, objectStoreName, databaseName, (err, success) => {
	if(err) {
		console.error(err);
	};
	if(success) {
		alert("Saved your favorites!");
	};
});
```

Or as properties of the object to be stored:
```javascript
const object_to_store = {
 key: "favorites",
 objectStoreName: "preferences"
 databaseName: "user"
 color: "teal",
 pets: "chihuahua",
 flower: "daisy"
};

simpleIndex.put(object_to_store, (err, success) => {
 if(err) {
	console.error(err);
 };
 if(success) {
	alert("Saved your favorites!");
 };
});
```

Remember to include a key property, as described in the config file, as a property of the object to be stored.

### get
*Syntax:*
```
get(key, objectStoreName, databaseName, callback(err, data))
```

*Parameters:*
```
`key` - either the key of the object to get, or a key object with properties key, objectStoreName and databaseName
`objectStoreName` - the name of the objectStore to use
`databaseName` - the name of the database to use
`callback` - a callback function which expects an err string and data object 
```

`<get>` works similarly to put. There are three options, and as with `<put>` it depends on the config file and the object to be retrieved.
If using the included simple database, no objectStoreName or databaseName is required. The key property is required. For example:
```javascript
const key = "favorites";

simpleIndex.get(key, (err, data) => {
 if(err) {
	console.error(err);
 };
 if(data) {
	//do something with data
 };
});
```

Using a database from the config file requires the objectStoreName name and databaseName name arguments to be supplied. They can either be included as arguments in the function call:
```javascript
const key = "favorites";

const objectStoreName = "preferences";

const databaseName = "user";

simpleIndex.get(key, objectStoreName, databaseName, (err, data) => {
 if(err) {
	console.error(err);
 };
 if(data) {
	// do something with data
 };
});
```

Or as properties of a key object to be retrieved:
```javascript
const key = {
 key: "favorites",
 objectStoreName: "preferences"
 databaseName: "user"
};

simpleIndex.get(key, (err, data) => {
 if(err) {
	console.error(err);
 ;
 if(data) {
	// do something with data
 ;
});
```
###remove
*Syntax:*
```
remove(key, [objectStoreName, databaseName,] callback(err, success))
```

*Parameters:*
`key` - either the key of the object to be removed, or a key object with properties key, objectStoreName and databaseName.
`objectStoreName` - the name of the objectStore to use
`databaseName` - the name of the database to use
`callback` - a callback function which expects an err string and success boolean

Much like the `<get>` function, `<remove>` can be used with three options. Rather than returning data however, success will either be true if the data was succefully removed from the database or false if it wasn’t able to be removed. If the object was not in the database, success will still be true.  

## Configuration
### Creating the simple-index.config.js file.

For developers who need a more robust database with many objectStores, or even multiple databases, include a config file in the root of the app and describe the desired database schema thusly:

```javascript
module.exports = {
 schema: {
	"databaseName": {
	 "objectStoreName": {
		keyPath: "key"
	 },
	},
 },
}
```

The simple-index module will automatically search for and use the config file to construct the database(s) in the indexedDB. The prefered place to save the file is in the root of the app. If using a bundler such as webpack, a resolve alias will need to be included in the webpack config file:
```
resolve: {
 alias: {
  'simple-index.config$' : path.resolve(__dirname, 'simple-index.config.js')
 }
},
```

*Other Config File Options:*

```
mode: either "development" or "production",
```
"development" mode will print errors to the console. "production" silences those errors. simple-index will generally work aroung errors, however, it's helpful to understand what's happening in the package to create an app that works as intended. Defaults to "production".

```
simple-on: true or false,
```
If true, simple-index will create the afformentioned simple database even if another database is described in the config. if false, the simple database will not be created and hence unavailable. Defaults to true.

```
delete: [],
```
An array of database names that should be removed from previous versions of indexedDB. This config option exists to ensure possibly large databases that are no longer required are removed.

A simple-index.config.js file could be written like this:
```javascript
module.exports = {
 schema: {
	"books": {
	 "fiction": {
		keyPath: "title"
	 },
	 "non-fiction": {
		keyPath: "title"
	 },
	},
	"food": {
	 "cheese": {
	  keyPath: "type"
	 },
	 "crackers": {
		keyPath: "flavor"
	 },
	},
 },
 mode: "development",
 simple-on: false,
 delete: ["oldDB", "yet_another_oldDB"],
};
```
