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

  it("should allow bidders to withdraw unused funds", async () => {
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
    await auction.endAuction(1, { from: accounts[0] });

    // Withdraw funds for accounts[1] (non-winning bidder)
    const initialBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[1]));
    const tx = await auction.withdraw(1, { from: accounts[1] });
    const finalBalance = web3.utils.toBN(await web3.eth.getBalance(accounts[1]));

    assert(finalBalance.gt(initialBalance), "Non-winning bidder should receive their funds back");

    // Ensure only remaining funds are withdrawn
    const auctionDetails = await auction.auctions(1);
    assert.equal(auctionDetails.bids[accounts[1]], "0", "Withdrawn balance should be set to zero");
  });
});