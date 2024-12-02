const EnglishAuction = artifacts.require("EnglishAuction");

contract("EnglishAuction", (accounts) => {
  
  let auction;
  const duration = 3600; // 1 hour
  const minBidIncrement = web3.utils.toWei("0.01", "ether"); // 0.01 ether

  beforeEach(async () => {
    // Deploy a new contract before each test with the defined duration and minBidIncrement
    auction = await EnglishAuction.new(duration, minBidIncrement);
  });

  it("should start with no bids", async () => {
    const highestBid = await auction.highestBid();
    assert.equal(highestBid.toString(), "0", "Initial highest bid should be 0");
  });

  it("should accept a higher bid", async () => {
    // Place a bid of 1 ether from accounts[1]
    await auction.placeBid({ from: accounts[1], value: web3.utils.toWei("1", "ether") });

    const highestBid = await auction.highestBid();
    assert.equal(web3.utils.fromWei(highestBid, "ether"), "1", "Highest bid should be 1 ether");

    // Check if the highest bidder is accounts[1]
    const highestBidder = await auction.highestBidder();
    assert.equal(highestBidder, accounts[1], "Highest bidder should be accounts[1]");

    // Check if the NewBidPlaced event was emitted
    const events = await auction.getPastEvents("NewBidPlaced", { fromBlock: 0, toBlock: "latest" });
    assert.equal(events.length, 1, "There should be one NewBidPlaced event");
    assert.equal(events[0].returnValues.bidder, accounts[1], "The bidder should be accounts[1]");
    assert.equal(web3.utils.fromWei(events[0].returnValues.amount, "ether"), "1", "The bid amount should be 1 ether");
  });

  it("should not accept a lower bid", async () => {
    // Place an initial valid bid of 1 ether from accounts[1]
    await auction.placeBid({ from: accounts[1], value: web3.utils.toWei("1", "ether") });
  
    // Attempt to place a lower bid (0.5 ether) from accounts[2]
    try {
      await auction.placeBid({ from: accounts[2], value: web3.utils.toWei("0.5", "ether") });
      assert.fail("Bid should not be accepted as it's lower than the highest bid plus the increment");
    } catch (error) {
      // Ensure the error is a revert with the specific message
      assert(error.message.includes("Bid must be higher than current bid plus the minimum increment"), "Expected revert error not found");
    }
  
    // Ensure the highest bid and highest bidder remain unchanged
    const highestBid = await auction.highestBid();
    assert.equal(web3.utils.fromWei(highestBid, "ether"), "1", "Highest bid should still be 1 ether");
  
    const highestBidder = await auction.highestBidder();
    assert.equal(highestBidder, accounts[1], "Highest bidder should still be accounts[1]");
  });

  it("should end the auction by the owner", async () => {
    // Simulate the passing of time by 1 hour (3600 seconds)
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
  
    // End the auction by the owner (accounts[0])
    await auction.endAuction({ from: accounts[0] });
  
    // Check if the auction has ended
    const ended = await auction.auctionEnded();
    assert.equal(ended, true, "Auction should be ended");
  
    // Check if the owner received the highest bid
    const ownerBalanceAfter = web3.utils.toBN(await web3.eth.getBalance(accounts[0]));
    const ownerBalanceBefore = ownerBalanceAfter.sub(web3.utils.toBN(web3.utils.toWei("1", "ether"))); // Assuming the bid was 1 ether
  
    assert(ownerBalanceAfter.gt(ownerBalanceBefore), "Owner should receive the highest bid after the auction ends");
  });

  it("should revert if non-owner tries to end the auction", async () => {
    try {
      // Try ending the auction as a non-owner (accounts[1])
      await auction.endAuction({ from: accounts[1] });
      assert.fail("Only the owner should be able to end the auction");
    } catch (error) {
      assert(error.message.includes("Only the owner can end the auction"), "Expected error message not found");
    }
  });
});