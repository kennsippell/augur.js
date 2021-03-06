/* eslint-env mocha */

"use strict";

var assert = require("chai").assert;
var proxyquire = require("proxyquire").noPreserveCache().noCallThru();

var orderFilledInputs = [{
  indexed: true,
  name: "universe",
  type: "address",
},
{
  indexed: true,
  name: "shareToken",
  type: "address",
},
{
  indexed: false,
  name: "filler",
  type: "address",
},
{
  indexed: false,
  name: "orderId",
  type: "bytes32",
},
{
  indexed: false,
  name: "numCreatorShares",
  type: "uint256",
},
{
  indexed: false,
  name: "numCreatorTokens",
  type: "uint256",
},
{
  indexed: false,
  name: "numFillerShares",
  type: "uint256",
},
{
  indexed: false,
  name: "numFillerTokens",
  type: "uint256",
},
{
  indexed: false,
  name: "marketCreatorFees",
  type: "uint256",
},
{
  indexed: false,
  name: "reporterFees",
  type: "uint256",
},
{
  indexed: false,
  name: "tradeGroupId",
  type: "uint256",
}];

describe("trading/get-trade-amount-remaining", function () {
  var test = function (t) {
    it(t.description, function (done) {
      var getTradeAmountRemaining = proxyquire("../../../src/trading/get-trade-amount-remaining", {
        "../contracts": t.mock.contracts,
        "../rpc-interface": t.mock.ethrpc,
      });
      getTradeAmountRemaining(t.params, function (err, tradeAmountRemaining) {
        t.assertions(err, tradeAmountRemaining);
        done();
      });
    });
  };
  test({
    description: "get trade amount remaining using transaction hash",
    params: {
      transactionHash: "TRANSACTION_HASH",
      startingOnChainAmount: "0x5af3107a4000", // 1
      priceNumTicksRepresentation: "0x1500", // 0.0276
    },
    mock: {
      contracts: {
        abi: {
          events: {
            Augur: {
              OrderFilled: {
                signature: "ORDER_FILLED_SIGNATURE",
                inputs: orderFilledInputs,
              },
            },
          },
        },
      },
      ethrpc: {
        getTransactionReceipt: function (transactionHash, callback) {
          callback({
            logs: [{
              topics: ["MAKE_ORDER_SIGNATURE"],
            }, {
              topics: ["ORDER_FILLED_SIGNATURE"],
              data: "0x00000000000000000000000095f75c360c056cf4e617f5ba2d9442706d6d43ed161860bb2d8b44d9b1faf2e220edd8ed17361b4fd00a87b129c22f0aacf4741800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000148454f793f0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000620e0dc3cd000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002a",
            }],
          });
        },
      },
    },
    assertions: function (err, tradeAmountRemaining) {
      assert.isNull(err);
      assert.strictEqual(tradeAmountRemaining, "82812500000000");
    },
  });
  test({
    description: "logs not present in receipt",
    params: {
      transactionHash: "TRANSACTION_HASH",
      startingOnChainAmount: "0x5af3107a4000",
      priceNumTicksRepresentation: "0x1500",
    },
    mock: {
      contracts: {
        abi: {
          events: {
            Augur: {
              OrderFilled: {
                signature: "ORDER_FILLED_SIGNATURE",
              },
            },
          },
        },
      },
      ethrpc: {
        getTransactionReceipt: function (transactionHash, callback) {
          callback({});
        },
      },
    },
    assertions: function (err, tradeAmountRemaining) {
      assert.strictEqual(err, "logs not found");
      assert.isUndefined(tradeAmountRemaining);
    },
  });
});
