const ERC721Mock = artifacts.require("ERC721Mock");

contract("ERC721Mock - Deployment Token Verification", (accounts) => {
    let erc721Mock;

    before(async () => {
        // Get the deployed contract instance
        erc721Mock = await ERC721Mock.deployed();
    });

    it("should verify all tokens minted during deployment", async () => {
        const tokens = await erc721Mock.fetchTokensByOwner(accounts[0]);
        console.log("Tokens for account", accounts[0], ":", tokens);
    
        // Convert BigNumber tokens to regular integers for comparison
        const convertedTokens = tokens.map(token => token.toString()); // Converts BigNumber to string
    
        // Define the expected tokens (these should match what the contract minted)
        const expectedTokens = [
            "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"  // As strings
        ];
    
        assert.deepEqual(convertedTokens, expectedTokens, "Tokens for account should match expected token IDs");
    });
    

    it("should check ownership of specific tokens", async () => {
        for (let tokenId = 0; tokenId < 50; tokenId++) { // Adjust range as needed
            try {
                const tokenOwner = await erc721Mock.ownerOf(tokenId);
                console.log(`Token ID ${tokenId} is owned by: ${tokenOwner}`);
            } catch (err) {
                console.log(`Token ID ${tokenId} does not exist.`);
            }
        }
    });  
});
