"use strict";

let si = require("../index.js");

describe('simple-index', () => {
  describe ('put', () => {
    it('should allow data to be stored in indexeddb', (done) => {
      si.put({key: 1}, (err, res) => {
        if (err) throw err;
        assert.notEqual(res, undefined);
        done();
      });
    })
  });
});
