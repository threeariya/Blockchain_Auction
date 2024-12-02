// SPDX-License-Identifier: MIT
const EnglishAuction = artifacts.require("EnglishAuction");

module.exports = function (deployer) {
  // Example: Deploying the EnglishAuction contract with a 1-hour duration (3600 seconds) 
  // and a minimum bid increment of 0.01 ether (in wei).
  const minBidIncrement = web3.utils.toWei("0.01", "ether"); // Converts 0.01 ether to wei
  deployer.deploy(EnglishAuction, 3600, minBidIncrement);
};