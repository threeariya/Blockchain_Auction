const ERC721Mock = artifacts.require("ERC721Mock");
const SecondPriceAuction = artifacts.require("SecondPriceAuction");

contract("SecondPriceAuction", (accounts) => {
  let auction;
  let nft;
  const tokenId = 1;

  beforeEach(async () => {
    // Deploy a mock ERC-721 contract
    nft = await ERC721Mock.new("NFT Mock", "NFTM");

    // Mint an NFT to account[0]
    await nft.mint(accounts[0], tokenId);

    // Deploy the EnglishAuction contract
    auction = await SecondPriceAuction.new({ from: accounts[0] });

    // Approve the auction contract to transfer the NFT
    await nft.approve(auction.address, tokenId, { from: accounts[0] });
  });

  it("should allow users to create a new auction", async () => {
    const duration = 3600; // 1 hour in seconds
    const minBidIncrement = web3.utils.toWei("0", "ether");
    const startingPrice = web3.utils.toWei("0.5", "ether"); // 0.5 ether
    const tx = await auction.createAuction(1, nft.address, tokenId, duration, minBidIncrement, startingPrice, { from: accounts[0] });

    // Fetch auction details
    const auctionDetails = await auction.auctions(1);

    // Validate auction creation
    assert.equal(auctionDetails.creator, accounts[0], "Auction creator should be accounts[0]");
    assert.isFalse(auctionDetails.auctionEnded, "Auction should not be ended");
    assert.equal(
      auctionDetails.startingPrice.toString(),
      startingPrice,
      "Starting price should be 0.5 ether"
    );
    assert.equal(
      auctionDetails.highestBid.toString(),
      startingPrice,
      "Highest bid should be initialized to the starting price"
    );

    // Validate event emission
    const event = tx.logs.find((log) => log.event === "AuctionCreated");
    assert.ok(event, "AuctionCreated event should be emitted");
    assert.equal(event.args.auctionId.toString(), "1", "Auction ID should be 1");
  });

  it("should allow users to place bids", async () => {
    const duration = 3600; // 1 hour in seconds
    const minBidIncrement = web3.utils.toWei("0", "ether");
    const startingPrice = web3.utils.toWei("0.5", "ether"); // 0.5 ether
    await auction.createAuction(1, nft.address, tokenId, duration, minBidIncrement, startingPrice, { from: accounts[0] });

    // Place bids
    await auction.submitBid(1, { from: accounts[1], value: web3.utils.toWei("1", "ether") });
    await auction.submitBid(1, { from: accounts[2], value: web3.utils.toWei("1.5", "ether") });

    // Fetch auction details
    const auctionDetails = await auction.auctions(1);

    // Validate highest and second-highest bids
    assert.equal(
      web3.utils.fromWei(auctionDetails.highestBid, "ether"),
      "1.5",
      "Highest bid should be 1.5 ether"
    );
    assert.equal(
      web3.utils.fromWei(auctionDetails.secondHighestBid, "ether"),
      "1",
      "Second-highest bid should be 1 ether"
    );
    assert.equal(auctionDetails.highestBidder, accounts[2], "Highest bidder should be accounts[2]");
  });

  it("should allow only the creator to end the auction", async () => {
    const duration = 3600; // 1 hour in seconds
    const minBidIncrement = web3.utils.toWei("0", "ether");
    const startingPrice = web3.utils.toWei("0.5", "ether"); // 0.5 ether
    await auction.createAuction(1, nft.address, tokenId, duration, minBidIncrement, startingPrice, { from: accounts[0] });

    // Place bids
    await auction.submitBid(1, { from: accounts[1], value: web3.utils.toWei("1", "ether") });
    await auction.submitBid(1, { from: accounts[2], value: web3.utils.toWei("1.5", "ether") });

    // Simulate time passing
    await new Promise((resolve, reject) => {
      web3.currentProvider.send(
        {
          jsonrpc: "2.0",
          method: "evm_increaseTime",
          params: [3600], // Increase time by 1 hour
          id: new Date().getTime(),
        },
        (err, res) => (err ? reject(err) : resolve(res))
      );
    });
    await new Promise((resolve, reject) => {
      web3.currentProvider.send(
        {
          jsonrpc: "2.0",
          method: "evm_mine",
          id: new Date().getTime(),
        },
        (err, res) => (err ? reject(err) : resolve(res))
      );
    });

    // End the auction
    const tx = await auction.endAuction(1, { from: accounts[0] });

    // Validate auction is marked as ended
    const auctionDetails = await auction.auctions(1);
    assert.isTrue(auctionDetails.auctionEnded, "Auction should be marked as ended");

    // Validate event emission
    const event = tx.logs.find((log) => log.event === "AuctionEnded");
    assert.ok(event, "AuctionEnded event should be emitted");
    assert.equal(event.args.winner, accounts[2], "Winner should be accounts[2]");
    assert.equal(
      web3.utils.fromWei(event.args.amount, "ether"),
      "1",
      "Winning payment should be 1 ether (second-highest bid)"
    );
  });

  it("should not allow non-creator to end the auction", async () => {
    const duration = 3600; // 1 hour in seconds
    const minBidIncrement = web3.utils.toWei("0", "ether");
    const startingPrice = web3.utils.toWei("0.5", "ether"); // 0.5 ether
    await auction.createAuction(1, nft.address, tokenId, duration, minBidIncrement, startingPrice, { from: accounts[0] });

    // Place bids
    await auction.submitBid(1, { from: accounts[1], value: web3.utils.toWei("1", "ether") });
    await auction.submitBid(1, { from: accounts[2], value: web3.utils.toWei("1.5", "ether") });

    // Attempt to end the auction from a non-creator account
    try {
      await auction.endAuction(1, { from: accounts[1] });
      assert.fail("Non-creator should not be able to end the auction");
    } catch (error) {
      assert(
        error.message.includes("Only the auction creator can perform this action"),
        "Expected revert for non-creator trying to end the auction"
      );
    }
  });

  // Additional Test Cases for Discussed Scenarios

  it("should handle a tie bid scenario", async () => {
    const duration = 3600; // 1 hour in seconds
    const minBidIncrement = web3.utils.toWei("0", "ether");
    const startingPrice = web3.utils.toWei("0.5", "ether"); // 0.5 ether
    await auction.createAuction(1, nft.address, tokenId, duration, minBidIncrement, startingPrice, { from: accounts[0] });

    // Place tied bids
    await auction.submitBid(1, { from: accounts[1], value: web3.utils.toWei("1", "ether") });
    await auction.submitBid(1, { from: accounts[2], value: web3.utils.toWei("1", "ether") });

    // Fetch auction details
    const auctionDetails = await auction.auctions(1);

    // Validate highest bid and second-highest bid
    assert.equal(
      web3.utils.fromWei(auctionDetails.highestBid, "ether"),
      "1",
      "Highest bid should be 1 ether"
    );
    assert.equal(
      web3.utils.fromWei(auctionDetails.secondHighestBid, "ether"),
      "1",
      "Second-highest bid should be the starting price"
    );

    // Validate highest bidder (should be the first bidder due to tie)
    assert.equal(
      auctionDetails.highestBidder,
      accounts[1],
      "Highest bidder should be accounts[1] in case of tie"
    );
  });

  it("should handle bids surpassing the highest bid", async () => {
    const duration = 3600; // 1 hour in seconds
    const minBidIncrement = web3.utils.toWei("0", "ether");
    const startingPrice = web3.utils.toWei("0.5", "ether"); // 0.5 ether
    await auction.createAuction(1, nft.address, tokenId, duration, minBidIncrement, startingPrice, { from: accounts[0] });

    // Place initial bids
    await auction.submitBid(1, { from: accounts[1], value: web3.utils.toWei("1", "ether") });
    await auction.submitBid(1, { from: accounts[2], value: web3.utils.toWei("1.5", "ether") });

    // Surpass highest bid
    await auction.submitBid(1, { from: accounts[3], value: web3.utils.toWei("2", "ether") });

    // Fetch auction details
    const auctionDetails = await auction.auctions(1);

    // Validate highest bid and second-highest bid
    assert.equal(
      web3.utils.fromWei(auctionDetails.highestBid, "ether"),
      "2",
      "Highest bid should be 2 ether"
    );
    assert.equal(
      web3.utils.fromWei(auctionDetails.secondHighestBid, "ether"),
      "1.5",
      "Second-highest bid should be 1.5 ether"
    );

    // Validate highest bidder
    assert.equal(auctionDetails.highestBidder, accounts[3], "Highest bidder should be accounts[3]");
  });

  it("should calculate the correct payment when ending an auction", async () => {
    const duration = 3600; // 1 hour in seconds
    const minBidIncrement = web3.utils.toWei("0.1", "ether");
    const startingPrice = web3.utils.toWei("0.5", "ether"); // 0.5 ether
    await auction.createAuction(1, nft.address, tokenId, duration, minBidIncrement, startingPrice, { from: accounts[0] });

    // Place bids
    await auction.submitBid(1, { from: accounts[1], value: web3.utils.toWei("1", "ether") });
    await auction.submitBid(1, { from: accounts[2], value: web3.utils.toWei("2", "ether") });

    // Simulate time passing
    await new Promise((resolve, reject) => {
      web3.currentProvider.send(
        {
          jsonrpc: "2.0",
          method: "evm_increaseTime",
          params: [3600], // Increase time by 1 hour
          id: new Date().getTime(),
        },
        (err, res) => (err ? reject(err) : resolve(res))
      );
    });
    await new Promise((resolve, reject) => {
      web3.currentProvider.send(
        {
          jsonrpc: "2.0",
          method: "evm_mine",
          id: new Date().getTime(),
        },
        (err, res) => (err ? reject(err) : resolve(res))
      );
    });

    // End the auction
    const tx = await auction.endAuction(1, { from: accounts[0] });

    // Validate payment
    const event = tx.logs.find((log) => log.event === "AuctionEnded");
    assert.equal(
      web3.utils.fromWei(event.args.amount, "ether"),
      "1",
      "Winning payment should be 1 ether (second-highest bid)"
    );
  });

  it("should handle bids surpassing the highest bid with minimum increment", async () => {
    const duration = 3600; // 1 hour in seconds
    const minBidIncrement = web3.utils.toWei("0.5", "ether"); // Minimum increment: 0.5 ether
    const startingPrice = web3.utils.toWei("0", "ether"); // Starting price: 0 ether
    await auction.createAuction(1, nft.address, tokenId, duration, minBidIncrement, startingPrice, { from: accounts[0] });

    // Account 1 places the first bid of 1 ether
    await auction.submitBid(1, { from: accounts[1], value: web3.utils.toWei("1", "ether") });

    // Account 2 places a bid of 1.3 ether (valid because it surpasses the highest bid by at least 0.5 ether)
    await auction.submitBid(1, { from: accounts[2], value: web3.utils.toWei("1.5", "ether") });

    // Fetch auction details after the bids
    const auctionDetails = await auction.auctions(1);

    // Validate highest bid and second-highest bid
    assert.equal(
        web3.utils.fromWei(auctionDetails.highestBid, "ether"),
        "1.5",
        "Highest bid should be 1.5 ether"
    );
    assert.equal(
        web3.utils.fromWei(auctionDetails.secondHighestBid, "ether"),
        "1",
        "Second-highest bid should be 1 ether"
    );

    // Validate highest bidder
    assert.equal(auctionDetails.highestBidder, accounts[2], "Highest bidder should be accounts[2]");

    // Simulate time passing to end the auction
    await new Promise((resolve, reject) => {
        web3.currentProvider.send(
            {
                jsonrpc: "2.0",
                method: "evm_increaseTime",
                params: [3600], // Increase time by 1 hour
                id: new Date().getTime(),
            },
            (err, res) => (err ? reject(err) : resolve(res))
        );
    });
    await new Promise((resolve, reject) => {
        web3.currentProvider.send(
            {
                jsonrpc: "2.0",
                method: "evm_mine",
                id: new Date().getTime(),
            },
            (err, res) => (err ? reject(err) : resolve(res))
        );
    });

    // End the auction
    const tx = await auction.endAuction(1, { from: accounts[0] });

    // Validate payment (second-highest bid, which is 1 ether)
    const event = tx.logs.find((log) => log.event === "AuctionEnded");
    assert.equal(
        web3.utils.fromWei(event.args.amount, "ether"),
        "1",
        "Winning payment should be 1 ether due to the second-highest bid"
    );
  });

  it("should reject bids below the minimum increment", async () => {
      const duration = 3600; // 1 hour in seconds
      const minBidIncrement = web3.utils.toWei("0.5", "ether"); // Minimum increment: 0.5 ether
      const startingPrice = web3.utils.toWei("0", "ether"); // Starting price: 0 ether
      await auction.createAuction(1, nft.address, tokenId, duration, minBidIncrement, startingPrice, { from: accounts[0] });

      // Account 1 places the first valid bid of 1 ether
      await auction.submitBid(1, { from: accounts[1], value: web3.utils.toWei("1", "ether") });

      // Account 2 attempts to place a bid of 1.4 ether (less than 1 + 0.5 ether)
      try {
          await auction.submitBid(1, { from: accounts[2], value: web3.utils.toWei("1.4", "ether") });
          assert.fail("The bid should have been rejected due to being below the minimum increment");
      } catch (error) {
          // Verify the error is related to bid validation
          assert(
              error.message.includes("Bid must be higher than current highest bid by at least the increment"),
              `Expected 'Bid increment too low' error, got '${error.message}' instead`
          );
      }

      // Fetch auction details to confirm state hasn't changed
      const auctionDetails = await auction.auctions(1);
      assert.equal(
          web3.utils.fromWei(auctionDetails.highestBid, "ether"),
          "1",
          "Highest bid should remain at 1 ether after invalid bid"
      );
      assert.equal(
          auctionDetails.highestBidder,
          accounts[1],
          "Highest bidder should remain accounts[1] after invalid bid"
      );
  });
});
