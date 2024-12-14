const ERC721Mock = artifacts.require("ERC721Mock");

module.exports = async function (deployer, network, accounts) {
  // Parameters for the contract
  const name = "MockNFT";
  const symbol = "MNFT";

  // Deploy the ERC721Mock contract
  await deployer.deploy(ERC721Mock, name, symbol);
  const instance = await ERC721Mock.deployed();

  console.log("Contract deployed at address:", instance.address);

  // Mint tokens for all accounts
  console.log("Minting tokens...");

  for (let i = 0; i < accounts.length; i++) {
    for (let j = 1; j <= 10; j++) {
      const tokenId = i * 10 + j; // Unique token IDs for each account
      await instance.mint(accounts[i], tokenId);
      console.log(`Token ID ${tokenId} minted to: ${accounts[i]}`);
    }
  }
};
