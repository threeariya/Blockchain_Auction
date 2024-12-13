const SecondPriceAuction = artifacts.require("SecondPriceAuction");

contract("SecondPriceAuction", (accounts) => {
  let auction;

  beforeEach(async () => {
    // Deploy a new instance of the SecondPriceAuction contract before each test
    auction = await SecondPriceAuction.new({ from: accounts[0] });
  });

  it("should allow users to create a new auction", async () => {
    // Create a new auction
    const duration = 3600; // 1 hour in seconds
    const tx = await auction.createAuction(1, duration, { from: accounts[0] });

    // Fetch auction details
    const auctionDetails = await auction.auctions(1);

    // Validate auction creation
    assert.equal(auctionDetails.creator, accounts[0], "Auction creator should be accounts[0]");
    assert.isFalse(auctionDetails.auctionEnded, "Auction should not be ended");
    assert.equal(
      auctionDetails.auctionEndTime.toNumber(),
      (await web3.eth.getBlock("latest")).timestamp + duration,
      "Auction end time should be correct"
    );

    // Validate event emission
    const event = tx.logs.find((log) => log.event === "AuctionCreated");
    assert.ok(event, "AuctionCreated event should be emitted");
    assert.equal(event.args.auctionId.toString(), "1", "Auction ID should be 1");
  });

  it("should allow users to place bids", async () => {
    const duration = 3600; // 1 hour in seconds
    await auction.createAuction(1, duration, { from: accounts[0] });

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
    await auction.createAuction(1, duration, { from: accounts[0] });

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
    await auction.createAuction(1, duration, { from: accounts[0] });

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
    await auction.createAuction(1, duration, { from: accounts[0] });

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
      "0",
      "Second-highest bid should be 0 ether"
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
    await auction.createAuction(1, duration, { from: accounts[0] });

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
    await auction.createAuction(1, duration, { from: accounts[0] });

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
});
