const SecondPriceAuction = artifacts.require("SecondPriceAuction");

module.exports = function (deployer) {
  // Deploy the SecondPriceAuction contract
  deployer.deploy(SecondPriceAuction);
};