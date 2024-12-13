const EnglishAuction = artifacts.require("EnglishAuction");

// module.exports = function (deployer) {
//   // Example values for duration (3600 seconds = 1 hour) and minimum bid increment
//   const duration = 3600;  // 1 hour in seconds
//   const minBidIncrement = web3.utils.toWei("0.01", "ether"); // 0.01 ether in wei

//   // Deploy the contract with the required parameters
//   deployer.deploy(EnglishAuction, duration, minBidIncrement);
// };

module.exports = function (deployer) {
  // Deploy the EnglishAuction contract
  deployer.deploy(EnglishAuction);
};
