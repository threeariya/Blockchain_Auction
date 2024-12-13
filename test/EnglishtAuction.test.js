const EnglishAuction = artifacts.require("EnglishAuction");

contract("EnglishAuction", (accounts) => {
  let auction;
  const duration = 3600; // 1 hour
  const minBidIncrement = web3.utils.toWei("0.01", "ether"); // 0.01 ether

  beforeEach(async () => {
    // Deploy the contract with the correct parameters: duration and minBidIncrement
    auction = await EnglishAuction.new(duration, minBidIncrement, { from: accounts[0] });
  });

  it("should allow any user to create their own auction", async () => {
    // Create an auction by accounts[0]
    const tx1 = await auction.createAuction(1, duration, minBidIncrement, { from: accounts[0] });
  
    // Verify that the auction details are correct
    const auctionDetails = await auction.auctions(1);
    assert.equal(auctionDetails.highestBid, "0", "Initial highest bid should be 0");
    assert.equal(auctionDetails.minBidIncrement.toString(), minBidIncrement, "Minimum bid increment should match");
    assert.isFalse(auctionDetails.auctionEnded, "Auction should not be ended");
    assert.equal(auctionDetails.creator, accounts[0], "Creator should be accounts[0]");
  
    // Check the AuctionCreated event emitted for auctionId 1
    const event1 = tx1.logs.find(log => log.event === "AuctionCreated");
    assert.ok(event1, "AuctionCreated event should be emitted");
    assert.equal(event1.args.auctionId.toString(), "1", "AuctionId in the event should be 1");
    assert.equal(event1.args.minBidIncrement.toString(), minBidIncrement, "Minimum bid increment in the event should match");
  
    // Create an auction by accounts[1]
    const tx2 = await auction.createAuction(2, duration, minBidIncrement, { from: accounts[1] });
  
    // Verify the auction details
    const auctionDetails2 = await auction.auctions(2);
    assert.equal(auctionDetails2.highestBid, "0", "Initial highest bid should be 0");
    assert.equal(auctionDetails2.minBidIncrement.toString(), minBidIncrement, "Minimum bid increment should match");
    assert.isFalse(auctionDetails2.auctionEnded, "Auction should not be ended");
    assert.equal(auctionDetails2.creator, accounts[1], "Creator should be accounts[1]");
  
    // Check the AuctionCreated event emitted for auctionId 2
    const event2 = tx2.logs.find(log => log.event === "AuctionCreated");
    assert.ok(event2, "AuctionCreated event should be emitted");
    assert.equal(event2.args.auctionId.toString(), "2", "AuctionId in the event should be 2");
    assert.equal(event2.args.minBidIncrement.toString(), minBidIncrement, "Minimum bid increment in the event should match");
  });

  it("should allow users to bid on any auction", async () => {
    await auction.createAuction(1, duration, minBidIncrement, { from: accounts[0] });

    // Place a bid of 1 ether from accounts[1]
    await auction.placeBid(1, { from: accounts[1], value: web3.utils.toWei("1", "ether") });

    const auctionDetails = await auction.auctions(1);
    assert.equal(
      web3.utils.fromWei(auctionDetails.highestBid, "ether"),
      "1",
      "Highest bid should be 1 ether"
    );
    assert.equal(auctionDetails.highestBidder, accounts[1], "Highest bidder should be accounts[1]");

    // Place a bid of 1.5 ether from accounts[2]
    await auction.placeBid(1, { from: accounts[2], value: web3.utils.toWei("1.5", "ether") });

    const auctionDetailsUpdated = await auction.auctions(1);
    assert.equal(
      web3.utils.fromWei(auctionDetailsUpdated.highestBid, "ether"),
      "1.5",
      "Highest bid should be 1.5 ether"
    );
    assert.equal(auctionDetailsUpdated.highestBidder, accounts[2], "Highest bidder should be accounts[2]");
  });

  it("should reject a bid lower than the minimum increment", async () => {
    await auction.createAuction(1, duration, minBidIncrement, { from: accounts[0] });

    // Place an initial valid bid of 1 ether
    await auction.placeBid(1, { from: accounts[1], value: web3.utils.toWei("1", "ether") });

    // Attempt to place a lower bid
    try {
      await auction.placeBid(1, { from: accounts[2], value: web3.utils.toWei("1.005", "ether") });
      assert.fail("Should not accept a bid lower than the minimum increment");
    } catch (error) {
      assert(
        error.message.includes("Bid must be higher than current bid plus the minimum increment"),
        "Expected revert error for insufficient bid"
      );
    }

    // Validate highest bid remains unchanged
    const auctionDetails = await auction.auctions(1);
    assert.equal(
      web3.utils.fromWei(auctionDetails.highestBid, "ether"),
      "1",
      "Highest bid should remain 1 ether"
    );
  });

  it("should allow the creator to end their auction after time has passed", async () => {
    await auction.createAuction(1, duration, minBidIncrement, { from: accounts[0] });

    // Place a valid bid
    await auction.placeBid(1, { from: accounts[1], value: web3.utils.toWei("1", "ether") });

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

    // Validate auction is marked as ended
    const auctionDetails = await auction.auctions(1);
    assert.isTrue(auctionDetails.auctionEnded, "Auction should be marked as ended");

    // Ensure the creator's balance increased (mock check, balance validation skipped for simplicity)
    const events = await auction.getPastEvents("AuctionEnded", { fromBlock: 0, toBlock: "latest" });
    assert.equal(events.length, 1, "There should be one AuctionEnded event");
    assert.equal(events[0].returnValues.winner, accounts[1], "Winner should be accounts[1]");
    assert.equal(
      web3.utils.fromWei(events[0].returnValues.amount, "ether"),
      "1",
      "Winning bid should be 1 ether"
    );
  });

  it("should revert if non-owner tries to end the auction", async () => {
    await auction.createAuction(1, duration, minBidIncrement, { from: accounts[0] });

    // Try to end the auction as a non-owner (accounts[1])
    try {
      await auction.endAuction(1, { from: accounts[1] });
      assert.fail("Non-creator should not be allowed to end the auction");
    } catch (error) {
      assert(
        error.message.includes("Only the creator can end the auction"),
        "Expected error for non-creator trying to end the auction"
      );
    }
  });

  it("should refund the previous highest bidder when a new highest bid is placed", async () => {
    // Create an auction
    await auction.createAuction(1, duration, minBidIncrement, { from: accounts[0] });
  
    // Place an initial bid of 1 ether from accounts[1]
    const initialBidder = accounts[1];
    const initialBid = web3.utils.toWei("1", "ether");
    await auction.placeBid(1, { from: initialBidder, value: initialBid });
  
    // Check the balance of the initial bidder before the new bid
    const initialBalance = await web3.eth.getBalance(initialBidder);
  
    // Place a higher bid of 1.5 ether from accounts[2]
    const newBidder = accounts[2];
    const newBid = web3.utils.toWei("1.5", "ether");
    await auction.placeBid(1, { from: newBidder, value: newBid });
  
    // Check the balance of the initial bidder after the new bid
    const finalBalance = await web3.eth.getBalance(initialBidder);
  
    // Verify that the previous highest bidder was refunded
    const refund = web3.utils.toBN(finalBalance).sub(web3.utils.toBN(initialBalance));
    assert.equal(refund.toString(), initialBid, "Previous highest bidder should be refunded their bid amount");
  
    // Verify the new highest bidder is updated
    const auctionDetails = await auction.auctions(1);
    assert.equal(
      web3.utils.fromWei(auctionDetails.highestBid, "ether"),
      "1.5",
      "Highest bid should be 1.5 ether"
    );
    assert.equal(auctionDetails.highestBidder, newBidder, "Highest bidder should be the new bidder");
  });

  it("should prevent the current highest bidder from re-bidding in the same auction", async () => {
    // Create an auction
    await auction.createAuction(1, duration, minBidIncrement, { from: accounts[0] });
  
    // Place an initial bid of 1 ether from accounts[1]
    const highestBidder = accounts[1];
    const initialBid = web3.utils.toWei("1", "ether");
    await auction.placeBid(1, { from: highestBidder, value: initialBid });
  
    // Attempt to place another bid by the same bidder
    try {
      const additionalBid = web3.utils.toWei("1.1", "ether"); // A valid higher bid
      await auction.placeBid(1, { from: highestBidder, value: additionalBid });
      assert.fail("Current highest bidder should not be able to place another bid");
    } catch (error) {
      assert(
        error.message.includes("You are already the highest bidder"),
        "Expected revert error for highest bidder re-bidding"
      );
    }
  
    // Verify that the auction state remains unchanged
    const auctionDetails = await auction.auctions(1);
    assert.equal(
      web3.utils.fromWei(auctionDetails.highestBid, "ether"),
      "1",
      "Highest bid should remain 1 ether"
    );
    assert.equal(
      auctionDetails.highestBidder,
      highestBidder,
      "Highest bidder should remain the same"
    );
  });
});


  it("should refund the previous highest bidder when a new highest bid is placed", async () => {
    // Create an auction
    await auction.createAuction(1, duration, minBidIncrement, { from: accounts[0] });
  
    // Place an initial bid of 1 ether from accounts[1]
    const initialBidder = accounts[1];
    const initialBid = web3.utils.toWei("1", "ether");
    await auction.placeBid(1, { from: initialBidder, value: initialBid });
  
    // Check the balance of the initial bidder before the new bid
    const initialBalance = await web3.eth.getBalance(initialBidder);
  
    // Place a higher bid of 1.5 ether from accounts[2]
    const newBidder = accounts[2];
    const newBid = web3.utils.toWei("1.5", "ether");
    await auction.placeBid(1, { from: newBidder, value: newBid });
  
    // Check the balance of the initial bidder after the new bid
    const finalBalance = await web3.eth.getBalance(initialBidder);
  
    // Verify that the previous highest bidder was refunded
    const refund = web3.utils.toBN(finalBalance).sub(web3.utils.toBN(initialBalance));
    assert.equal(refund.toString(), initialBid, "Previous highest bidder should be refunded their bid amount");
  
    // Verify the new highest bidder is updated
    const auctionDetails = await auction.auctions(1);
    assert.equal(
      web3.utils.fromWei(auctionDetails.highestBid, "ether"),
      "1.5",
      "Highest bid should be 1.5 ether"
    );
    assert.equal(auctionDetails.highestBidder, newBidder, "Highest bidder should be the new bidder");
  });

  it("should prevent the current highest bidder from re-bidding in the same auction", async () => {
    // Create an auction
    await auction.createAuction(1, duration, minBidIncrement, { from: accounts[0] });
  
    // Place an initial bid of 1 ether from accounts[1]
    const highestBidder = accounts[1];
    const initialBid = web3.utils.toWei("1", "ether");
    await auction.placeBid(1, { from: highestBidder, value: initialBid });
  
    // Attempt to place another bid by the same bidder
    try {
      const additionalBid = web3.utils.toWei("1.1", "ether"); // A valid higher bid
      await auction.placeBid(1, { from: highestBidder, value: additionalBid });
      assert.fail("Current highest bidder should not be able to place another bid");
    } catch (error) {
      assert(
        error.message.includes("You are already the highest bidder"),
        "Expected revert error for highest bidder re-bidding"
      );
    }
  
    // Verify that the auction state remains unchanged
    const auctionDetails = await auction.auctions(1);
    assert.equal(
      web3.utils.fromWei(auctionDetails.highestBid, "ether"),
      "1",
      "Highest bid should remain 1 ether"
    );
    assert.equal(
      auctionDetails.highestBidder,
      highestBidder,
      "Highest bidder should remain the same"
    );
  });
});