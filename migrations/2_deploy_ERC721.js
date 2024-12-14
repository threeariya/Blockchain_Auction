const ERC721Mock = artifacts.require("ERC721Mock");

module.exports = async function (deployer) {
  // Parameters for the contract
  const name = "MockNFT";
  const symbol = "MNFT";

  // Deploy the ERC721Mock contract
  await deployer.deploy(ERC721Mock, name, symbol);
};