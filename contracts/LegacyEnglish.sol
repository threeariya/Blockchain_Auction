// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract EnglishAuction {
    address public owner;
    address public highestBidder;
    uint256 public highestBid;
    bool public auctionEnded;
    uint256 public auctionEndTime;
    uint256 public minBidIncrement;

    // Events for tracking auction state
    event NewBidPlaced(address indexed bidder, uint256 amount);
    event AuctionEnded(address winner, uint256 amount);

    constructor(uint256 _duration, uint256 _minBidIncrement) {
        owner = msg.sender;
        auctionEnded = false;
        highestBid = 0;
        auctionEndTime = block.timestamp + _duration; // Set auction duration
        minBidIncrement = _minBidIncrement; // Set minimum bid increment
    }

    // Modifier to check if the auction has ended
    modifier auctionActive() {
        require(!auctionEnded, "Auction has ended");
        require(block.timestamp < auctionEndTime, "Auction has expired");
        _;
    }

    // Function to place a bid
    function placeBid() external payable auctionActive {
        require(msg.value > highestBid + minBidIncrement, "Bid must be higher than current bid plus the minimum increment");

        // Refund the previous highest bidder
        if (highestBid > 0) {
            payable(highestBidder).transfer(highestBid);
        }

        // Update the highest bid and bidder
        highestBidder = msg.sender;
        highestBid = msg.value;

        // Emit event for a new bid
        emit NewBidPlaced(msg.sender, msg.value);
    }

    // Function to end the auction manually (owner only)
    function endAuction() external {
        require(msg.sender == owner, "Only the owner can end the auction");
        require(block.timestamp >= auctionEndTime, "Auction has not yet ended");
        require(!auctionEnded, "Auction already ended");

        auctionEnded = true;

        // Transfer funds to the owner
        payable(owner).transfer(highestBid);

        // Emit event for auction end
        emit AuctionEnded(highestBidder, highestBid);
    }

    // Function to withdraw bid if you are the highest bidder (before auction ends)
    function withdrawBid() external {
        require(msg.sender == highestBidder, "Only the highest bidder can withdraw");
        require(block.timestamp < auctionEndTime, "Auction has ended, cannot withdraw");

        uint256 amount = highestBid;
        highestBid = 0;
        highestBidder = address(0);

        payable(msg.sender).transfer(amount);

        emit NewBidPlaced(msg.sender, 0); // Emit zero bid event for withdrawal
    }

    // Get current auction time remaining
    function timeRemaining() external view returns (uint256) {
        if (block.timestamp >= auctionEndTime) {
            return 0;
        }
        return auctionEndTime - block.timestamp;
    }
}
