const ERC721Mock = artifacts.require("ERC721Mock");
const EnglishAuction = artifacts.require("EnglishAuction");

contract("EnglishAuction", (accounts) => {
  let auction;
  let nft;
  const duration = 3600; // 1 hour
  const minBidIncrement = web3.utils.toWei("0.01", "ether"); // 0.01 ether
  const startingPrice = web3.utils.toWei("0", "ether"); // Starting price set to 0 ether
  const tokenId = 1;

  beforeEach(async () => {
    // Deploy a mock ERC-721 contract
    nft = await ERC721Mock.new("NFT Mock", "NFTM");

    // Mint an NFT to account[0]
    await nft.mint(accounts[0], tokenId);

    // Deploy the EnglishAuction contract
    auction = await EnglishAuction.new("AuctionToken", "ATK");

    // Approve the auction contract to transfer the NFT
    await nft.approve(auction.address, tokenId, { from: accounts[0] });
  });

  it("should allow any user to create their own auction", async () => {
    // Create an auction by accounts[0]
    const tx1 = await auction.createAuction(
      1, 
      nft.address, 
      tokenId, 
      duration, 
      minBidIncrement, 
      startingPrice, 
      { from: accounts[0] }
    );

    // Verify that the auction details are correct
    const auctionDetails = await auction.getAuctionDetails(1);
    assert.equal(auctionDetails.highestBid.toString(), "0", "Initial highest bid should be 0");
    assert.equal(
      auctionDetails.minBidIncrement.toString(),
      minBidIncrement,
      "Minimum bid increment should match"
    );
    assert.isFalse(auctionDetails.auctionEnded, "Auction should not be ended");
    assert.equal(auctionDetails.creator, accounts[0], "Creator should be accounts[0]");

    // Check the AuctionCreated event emitted for auctionId 1
    const event1 = tx1.logs.find((log) => log.event === "AuctionCreated");
    assert.ok(event1, "AuctionCreated event should be emitted");
    assert.equal(event1.args.auctionId.toString(), "1", "AuctionId in the event should be 1");
    assert.equal(
      event1.args.minBidIncrement.toString(),
      minBidIncrement,
      "Minimum bid increment in the event should match"
    );

    // Create another auction by accounts[1]
    const tokenId2 = 2;
    await nft.mint(accounts[1], tokenId2);
    await nft.approve(auction.address, tokenId2, { from: accounts[1] });

    const tx2 = await auction.createAuction(
      2, 
      nft.address, 
      tokenId2, 
      duration, 
      minBidIncrement, 
      startingPrice, 
      { from: accounts[1] }
    );

    // Verify the auction details
    const auctionDetails2 = await auction.getAuctionDetails(2);
    assert.equal(auctionDetails2.highestBid.toString(), "0", "Initial highest bid should be 0");
    assert.equal(
      auctionDetails2.minBidIncrement.toString(),
      minBidIncrement,
      "Minimum bid increment should match"
    );
    assert.isFalse(auctionDetails2.auctionEnded, "Auction should not be ended");
    assert.equal(auctionDetails2.creator, accounts[1], "Creator should be accounts[1]");

    // Check the AuctionCreated event emitted for auctionId 2
    const event2 = tx2.logs.find((log) => log.event === "AuctionCreated");
    assert.ok(event2, "AuctionCreated event should be emitted");
    assert.equal(event2.args.auctionId.toString(), "2", "AuctionId in the event should be 2");
    assert.equal(
      event2.args.minBidIncrement.toString(),
      minBidIncrement,
      "Minimum bid increment in the event should match"
    );
  });

  it("should allow users to bid on any auction", async () => {
    await auction.createAuction(1, nft.address, tokenId, duration, minBidIncrement, startingPrice, { from: accounts[0] });

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
    await auction.createAuction(1, nft.address, tokenId, duration, minBidIncrement, startingPrice, { from: accounts[0] });

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
    await auction.createAuction(1, nft.address, tokenId, duration, minBidIncrement, startingPrice, { from: accounts[0] });

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
    await auction.createAuction(1, nft.address, tokenId, duration, minBidIncrement, startingPrice, { from: accounts[0] });

    // Try to end the auction as a non-owner (accounts[1])
    try {
      await auction.endAuction(1, { from: accounts[1] });
      assert.fail("Non-creator should not be allowed to end the auction");
    } catch (error) {
      assert(
        error.message.includes("Only the auction creator can perform this action"),
        "Expected error for non-creator trying to end the auction"
      );
    }
  });

  it("should refund the previous highest bidder when a new highest bid is placed", async () => {
    // Create an auction
    await auction.createAuction(1, nft.address, tokenId, duration, minBidIncrement, startingPrice, { from: accounts[0] });
  
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
    await auction.createAuction(1, nft.address, tokenId, duration, minBidIncrement, startingPrice, { from: accounts[0] });
  
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

  it("should allow the owner to withdraw funds after the auction ends", async () => {
    // Create an auction by the owner (accounts[0])
    const owner = accounts[0];
    const highestBidder = accounts[1];
    const bidAmount = web3.utils.toWei("1", "ether");
  
    await auction.createAuction(1, nft.address, tokenId, duration, minBidIncrement, startingPrice, { from: owner });
  
    // Place a bid by accounts[1]
    await auction.placeBid(1, { from: highestBidder, value: bidAmount });
  
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
  
    // End the auction by the owner
    await auction.endAuction(1, { from: owner });
  
    // Record the owner's balance before withdrawal
    const ownerBalanceBefore = web3.utils.toBN(await web3.eth.getBalance(owner));
  
    // Withdraw funds (Correct function name is withdraw)
    const tx = await auction.withdraw(1, { from: owner });
  
    // Record the owner's balance after withdrawal
    const ownerBalanceAfter = web3.utils.toBN(await web3.eth.getBalance(owner));
  
    // Calculate gas cost
    const gasUsed = web3.utils.toBN(tx.receipt.gasUsed);
    const txDetails = await web3.eth.getTransaction(tx.tx);
    const gasPrice = web3.utils.toBN(txDetails.gasPrice);
    const gasCost = gasUsed.mul(gasPrice);
  
    // Verify the owner's balance increased by the bid amount minus gas cost
    assert.equal(
      ownerBalanceAfter.toString(),
      ownerBalanceBefore.add(web3.utils.toBN(bidAmount)).sub(gasCost).toString(),
      "Owner's balance should increase by the bid amount minus gas cost"
    );
  
    // Ensure funds are withdrawn from the contract
    const contractBalance = await web3.eth.getBalance(auction.address);
    assert.equal(contractBalance, "0", "Contract balance should be 0 after withdrawal");
  }); 
  
  it("should set the starting price to 10 when creating an auction", async () => {
    const owner = accounts[0];
    const auctionId = 1;
    const duration = 3600; // 1 hour duration
    const minBidIncrement = 5; // Minimum bid increment
    const startingPrice = web3.utils.toWei("10", "ether"); // Starting price of 10 ether
  
    // Create the auction with a starting price of 10 ether
    await auction.createAuction(auctionId, nft.address, tokenId, duration, minBidIncrement, startingPrice, { from: owner });
  
    // Fetch auction details
    const auctionDetails = await auction.getAuctionDetails(auctionId);
  
    // Assert that the starting price is set correctly (highestBid should be 10 ether)
    assert.equal(auctionDetails.highestBid.toString(), startingPrice, "Starting price should be set to 10 ether");
  });
  
  it("should enforce the minimum bid increment when placing bids", async () => {
    const owner = accounts[0];
    const bidder1 = accounts[1];
    const bidder2 = accounts[2];
    const auctionId = 2;
    const duration = 3600; // 1 hour duration
    const minBidIncrement = web3.utils.toWei("5", "ether"); // Minimum bid increment set to 5 ether
  
    // Create the auction
    await auction.createAuction(auctionId, nft.address, tokenId, duration, minBidIncrement, startingPrice, { from: owner });
  
    // Place the first bid (this should succeed)
    const firstBidAmount = web3.utils.toWei("10", "ether"); // Bidder1 bids 10 ether
    await auction.placeBid(auctionId, { from: bidder1, value: firstBidAmount });
  
    // Get auction details after the first bid
    let auctionDetails = await auction.getAuctionDetails(auctionId);
    assert.equal(auctionDetails.highestBid.toString(), firstBidAmount, "First bid should be the highest bid");
  
    // Try to place a second bid that doesn't meet the minimum bid increment (should fail)
    const invalidBidAmount = web3.utils.toWei("14", "ether"); // 14 ether is less than the required 15 ether (10 + 5)
    try {
      await auction.placeBid(auctionId, { from: bidder2, value: invalidBidAmount });
      assert.fail("Bid smaller than the required increment should fail");
    } catch (error) {
      assert.include(error.message, "Bid must be higher than current bid plus the minimum increment", "Error message should contain the correct message");
    }
  
    // Place a valid bid by bidder2 (this should succeed)
    const validBidAmount = web3.utils.toWei("15", "ether"); // Bidder2 bids 15 ether, which is valid
    await auction.placeBid(auctionId, { from: bidder2, value: validBidAmount });
  
    // Get auction details after the valid second bid
    auctionDetails = await auction.getAuctionDetails(auctionId);
    assert.equal(auctionDetails.highestBid.toString(), validBidAmount, "Second bid should be the highest bid");
  });
  
  it("should deny withdrawal if the auction has not ended yet", async () => {
    // Create an auction
    await auction.createAuction(1, nft.address, tokenId, duration, minBidIncrement, startingPrice, { from: accounts[0] });
  
    // Place a bid from accounts[1]
    const bidAmount = web3.utils.toWei("1", "ether");
    await auction.placeBid(1, { from: accounts[1], value: bidAmount });
  
    // Try to withdraw funds before the auction ends
    try {
      await auction.withdraw(1, { from: accounts[0] }); // Attempt to withdraw by the owner (creator) before the auction ends
      assert.fail("Withdrawal should not be allowed before the auction ends");
    } catch (error) {
      assert(
        error.message.includes("Auction has not yet ended"),
        "Expected error for attempting to withdraw before the auction ends"
      );
    }
  
    // Ensure the contract balance is still holding the funds (no withdrawal occurred)
    const contractBalance = await web3.eth.getBalance(auction.address);
    assert.equal(
      contractBalance,
      bidAmount,
      "Contract balance should remain unchanged as the withdrawal should fail"
    );
  });
  
  it("should allow only the NFT owner to create an auction", async () => {
    // Try to create an auction by an address that doesn't own the NFT (accounts[1])
    try {
      await auction.createAuction(
        1, 
        nft.address, 
        tokenId, 
        duration, 
        minBidIncrement, 
        startingPrice, 
        { from: accounts[1] }
      );
      assert.fail("The auction should only be created by the owner of the NFT");
    } catch (error) {
      assert(error.message.includes("Not the NFT owner"), "Expected error not thrown");
    }
    
    // Create auction by the owner of the NFT (accounts[0])
    const tx = await auction.createAuction(
      1, 
      nft.address, 
      tokenId, 
      duration, 
      minBidIncrement, 
      startingPrice, 
      { from: accounts[0] }
    );
    
    // Ensure that the auction is created successfully by the owner
    const auctionDetails = await auction.getAuctionDetails(1);
    assert.equal(auctionDetails.creator, accounts[0], "Auction creator should be the owner of the NFT");
  });  

  it("should transfer NFT ownership to the highest bidder after auction ends", async () => {
    await auction.createAuction(
      1,
      nft.address,
      tokenId, 
      duration,
      minBidIncrement,
      startingPrice,
      { from: accounts[0] }
    );
  
    const bidAmount = web3.utils.toWei("0.1", "ether");
    await auction.placeBid(1, { from: accounts[1], value: bidAmount });
    const auctionDetails = await auction.getAuctionDetails(1);
    console.log("Auction details ending", auctionDetails);
  
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

    console.log("accounts[0]:", accounts[0]);
    console.log("accounts[1]:", accounts[1]);
  
    await auction.endAuction(1, { from: accounts[0] });
    const newOwner = await nft.ownerOf(tokenId);
    assert.equal(
      newOwner,
      accounts[1],
      "The NFT ownership should have transferred to the highest bidder"
    );
  });
});