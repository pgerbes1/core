'use strict';

var crypto = require('crypto');
var expect = require('chai').expect;
var AuditStream = require('../lib/auditstream');
var Audit = require('../lib/audit');
var sinon = require('sinon');
var utils = require('../lib/utils');

var SHARD = new Buffer('testshard');

describe('AuditStream', function() {

  describe('@constructor', function() {

    it('should create instance without the new keyword', function() {
      expect(AuditStream(24)).to.be.instanceOf(AuditStream);
    });

    it('should create challenges for the specified audits', function() {
      var audit = new AuditStream(24);
      expect(audit._challenges).to.have.lengthOf(24);
    });

  });

  describe('#_generateChallenge', function() {

    it('should return a random 256 bit challenge', function() {
      var challenge = AuditStream(6)._generateChallenge();
      expect(challenge).to.have.lengthOf(64);
      expect(Buffer(challenge, 'hex')).to.have.lengthOf(32);
    });

  });

  describe('#_createResponseInput', function() {

    it('should return double hash of data plus hex encoded shard', function() {
      var audit = new AuditStream(6);
      var data = new Buffer('test').toString('hex');
      var response = audit._createResponseInput(data);
      expect(response).to.be.instanceOf(crypto.Hash);
    });

  });

  describe('#getPublicRecord', function() {

    it('should return the bottom leaves of the merkle tree', function(done) {
      var audit = new AuditStream(12);
      audit.on('finish', function() {
        var leaves = audit.getPublicRecord();
        var branch = audit._tree.level(4);
        leaves.forEach(function(leaf) {
          expect(branch.indexOf(leaf)).to.not.equal(-1);
        });
        done();
      });
      audit.write(SHARD);
      audit.end();
    });

  });

  describe('#getPrivateRecord', function() {

    it('should return the root, depth, and challenges', function(done) {
      var audit = new AuditStream(12);
      audit.on('finish', function() {
        var secret = audit.getPrivateRecord();
        expect(secret.root).to.equal(audit._tree.root().toLowerCase());
        expect(secret.depth).to.equal(audit._tree.levels());
        expect(secret.challenges).to.equal(audit._challenges);
        done();
      });
      audit.write(SHARD);
      audit.end();
    });

  });

});

describe('Audit+AuditStream/Compatibility', function() {

  it('should return the same structures given the same input', function(done) {
    var counter1 = 0;
    var counter2 = 0;
    var _genChal1 = sinon.stub(
      Audit.prototype,
      '_generateChallenge',
      function() {
        return utils.rmd160((++counter1).toString());
      }
    );
    var _genChal2 = sinon.stub(
      AuditStream.prototype,
      '_generateChallenge',
      function() {
        return utils.rmd160((++counter2).toString());
      }
    );
    var audit = new Audit({ audits: 12, shard: SHARD });
    var auditstream = new AuditStream(12);
    auditstream.on('finish', function() {
      audit.getPublicRecord().forEach(function(record, i) {
        expect(auditstream.getPublicRecord()[i]).to.equal(record);
      });
      expect(
        audit.getPrivateRecord().root
      ).to.equal(
        auditstream.getPrivateRecord().root
      );
      expect(
        audit.getPrivateRecord().depth
      ).to.equal(
        auditstream.getPrivateRecord().depth
      );
      audit.getPrivateRecord().challenges.forEach(function(chal, i) {
        expect(
          auditstream.getPrivateRecord().challenges[i]
        ).to.equal(
          chal
        );
      });
      _genChal1.restore();
      _genChal2.restore();
      done();
    });
    auditstream.write(SHARD);
    auditstream.end();
  });

});
