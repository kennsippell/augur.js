"use strict";

var assign = require("lodash.assign");
var BigNumber = require("bignumber.js");
var immutableDelete = require("immutable-delete");
var finalizeMarket = require("./finalize-market");
var api = require("../api");
var DUST_THRESHOLD = require("../constants").DUST_THRESHOLD;
var noop = require("../utils/noop");

/**
 * @param {Object} p Parameters object.
 * @param {string} p._market Address of the market to redeem Stake tokens from, as a hex string.
 * @param {string} p._reporter Reporter for whom to redeem Stake tokens.
 * @param {string[]} p._payoutNumerators Relative payout amounts to traders holding shares of each outcome, as an array of base-10 strings.
 * @param {{signer: buffer|function, accountType: string}=} p.meta Authentication metadata for raw transactions.
 * @param {function} p.onSent Called if/when the transaction is broadcast to the network.
 * @param {function} p.onSuccess Called if/when the transaction is sealed and confirmed.
 * @param {function} p.onFailed Called if/when the transaction fails.
 */
function redeem(p) {
  api().Market.getStakeToken({
    tx: { to: p._market },
    _payoutNumerators: p._payoutNumerators,
  }, function (err, stakeTokenContractAddress) {
    if (err) return p.onFailed(err);
    api().StakeToken.balanceOf({
      tx: { to: stakeTokenContractAddress },
      address: p._reporter,
    }, function (err, stakeTokenBalance) {
      if (err) return p.onFailed(err);
      if (new BigNumber(stakeTokenBalance, 16).lt(DUST_THRESHOLD)) { // TODO calculate DUST_THRESHOLD
        return p.onFailed("Gas cost to redeem reporting tokens is greater than the value of the tokens");
      }

      // On any token contract that is no longer attached to a market (happens when some other market in your reporting
      // window forks, causing your market to move universees).  Note: disavowed can be redeemed any time (regardless of
      // reporting window, market finalization, etc.)
      api().Market.isContainerForStakeToken({
        tx: { to: p._market },
        _stakeToken: stakeTokenContractAddress,
      }, function (err, isContainerForStakeToken) {
        if (err) return p.onFailed(err);
        var redeemPayload = assign({}, immutableDelete(p, ["market", "_payoutNumerators"]), {
          tx: { to: stakeTokenContractAddress },
        });
        if (!parseInt(isContainerForStakeToken, 16)) { // if disavowed
          api().StakeToken.redeemDisavowedTokens(redeemPayload);
        } else {
          finalizeMarket(assign({}, immutableDelete(p, ["_reporter", "_payoutNumerators"]), {
            onSent: noop,
            onSuccess: function (isFinalized) {
              if (isFinalized === false) return p.onFailed("Market not yet finalized");
              api().StakeToken.getUniverse({ tx: { to: stakeTokenContractAddress } }, function (err, universeContractAddress) {
                if (err) return p.onFailed(err);

                // On any token contract attached to a market that ended in a fork.
                // (Note: forked and winning both require the market to be finalized.)
                api().Universe.getForkingMarket({ tx: { to: universeContractAddress } }, function (err, forkingMarket) {
                  if (err) return p.onFailed(err);
                  if (forkingMarket === p._market) {
                    api().StakeToken.redeemForkedTokens(redeemPayload);
                  } else {

                    // Redeem winning reporting tokens.
                    api().Market.getFinalWinningStakeToken({ tx: { to: p._market } }, function (err, finalWinningStakeToken) {
                      if (err) return p.onFailed(err);
                      if (finalWinningStakeToken !== stakeTokenContractAddress) {
                        return p.onFailed("No winning tokens to redeem");
                      }
                      api().StakeToken.redeemWinningTokens(redeemPayload);
                    });
                  }
                });
              });
            },
          }));
        }
      });
    });
  });
}

module.exports = redeem;
