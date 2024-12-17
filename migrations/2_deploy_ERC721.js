const ERC721Mock = artifacts.require("ERC721Mock");

module.exports = async function (deployer, network, accounts) {
  // Parameters for the contract
  const name = "MockNFT";
  const symbol = "MNFT";

  // Deploy the ERC721Mock contract
  await deployer.deploy(ERC721Mock, name, symbol);
  const instance = await ERC721Mock.deployed();

  console.log("Contract deployed at address:", instance.address);

  // Mint tokens for all accounts using mintNext to ensure sequential minting
  console.log("Minting tokens...");

  for (let i = 0; i < accounts.length; i++) {
    for (let j = 0; j < 10; j++) {
      const tokenId = await instance.mintNext(accounts[i]);
      console.log(`Token ID ${tokenId} minted to: ${accounts[i]}`);
    }
  }
};
