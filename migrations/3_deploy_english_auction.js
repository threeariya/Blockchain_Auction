const EnglishAuction = artifacts.require("EnglishAuction");

module.exports = async function (deployer, network, accounts) {
    // Pass the constructor arguments for name and symbol
    const name = "AuctionToken";
    const symbol = "ATK";

    await deployer.deploy(EnglishAuction, name, symbol);

    const auctionInstance = await EnglishAuction.deployed();
    console.log("EnglishAuction deployed at address:", auctionInstance.address);
};