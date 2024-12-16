// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract LegacySecondPriceAuction {
    using Address for address payable;

    struct Auction {
        uint256 auctionEndTime;
        bool auctionEnded;
        address creator;
        uint256 highestBid; // Highest bid amount
        uint256 secondHighestBid; // Second-highest bid
        uint256 startingPrice; // The starting price of the auction
        uint256 bidIncrement; // Minimum increment required for the next bid
        address highestBidder;
        mapping(address => uint256) bids; // Bids submitted by participants
    }

    mapping(uint256 => Auction) public auctions;

    bool private locked = false; // Custom reentrancy guard

    event AuctionCreated(uint256 auctionId, uint256 duration, address creator);
    event BidSubmitted(uint256 auctionId, address indexed bidder, uint256 amount);
    event AuctionEnded(uint256 auctionId, address winner, uint256 amount);

    modifier nonReentrant() {
        require(!locked, "Reentrant call detected");
        locked = true;
        _;
        locked = false;
    }

    modifier auctionActive(uint256 auctionId) {
        require(!auctions[auctionId].auctionEnded, "Auction has ended");
        require(block.timestamp < auctions[auctionId].auctionEndTime, "Auction has expired");
        _;
    }

    modifier onlyAuctionCreator(uint256 auctionId) {
        require(msg.sender == auctions[auctionId].creator, "Only the auction creator can perform this action");
        _;
    }

    // Create a new second-price auction
    function createAuction(
        uint256 auctionId,
        uint256 _duration,
        uint256 _bidIncrement, // Optionally set bid increment
        uint256 _startingPrice // Optionally set starting price
    ) external {
        require(auctions[auctionId].auctionEndTime == 0, "Auction already exists");

        // Initialize the auction fields individually
        Auction storage auction = auctions[auctionId];
        auction.auctionEndTime = block.timestamp + _duration;
        auction.auctionEnded = false;
        auction.creator = msg.sender;

        // Set the starting price and bid increment, default to 0 if not provided
        auction.startingPrice = _startingPrice == 0 ? 0 : _startingPrice;
        auction.bidIncrement = _bidIncrement == 0 ? 0 : _bidIncrement;

        // Set the highest bid to the starting price if provided, otherwise start at 0
        auction.highestBid = auction.startingPrice;

        // Initialize the second-highest bid and highest bidder
        auction.secondHighestBid = 0;
        auction.highestBidder = address(0);

        emit AuctionCreated(auctionId, _duration, msg.sender);
    }

    // Submit a bid (sealed bid process)
    function submitBid(uint256 auctionId) external payable auctionActive(auctionId) nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(msg.value > 0, "Bid value must be greater than zero");

        uint256 newBidAmount = auction.bids[msg.sender] + msg.value;

        // If starting price is 0, the first bid can be any positive value
        if (auction.startingPrice == 0) {
            // If this is the first bid, no increment condition
            require(newBidAmount > auction.highestBid, "Bid must be higher than the current highest bid");
        } else {
            // Ensure the new bid is higher than the highest bid by at least the increment
            require(newBidAmount >= auction.highestBid + auction.bidIncrement, "Bid must be higher than current highest bid by at least the increment");
        }

        auction.bids[msg.sender] = newBidAmount;

        // Update highest and second-highest bids
        if (newBidAmount > auction.highestBid) {
            // Update second-highest bid before changing the highest
            auction.secondHighestBid = auction.highestBid;
            auction.highestBid = newBidAmount;
            auction.highestBidder = msg.sender;
        } else if (newBidAmount > auction.secondHighestBid) {
            // Update second-highest bid if higher than current second-highest
            auction.secondHighestBid = newBidAmount;
        }

        emit BidSubmitted(auctionId, msg.sender, msg.value);
    }


    // End the auction and transfer funds
    function endAuction(uint256 auctionId) external onlyAuctionCreator(auctionId) nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(block.timestamp >= auction.auctionEndTime, "Auction has not yet ended");
        require(!auction.auctionEnded, "Auction already ended");

        auction.auctionEnded = true;

        // Transfer the second-highest bid amount to the creator
        payable(auction.creator).sendValue(auction.secondHighestBid);

        // Refund any overbids to the winner
        uint256 refund = auction.highestBid - auction.secondHighestBid;
        if (refund > 0) {
            payable(auction.highestBidder).sendValue(refund);
        }

        emit AuctionEnded(auctionId, auction.highestBidder, auction.secondHighestBid);
    }

    // Allow bidders to withdraw their unused funds
    function withdraw(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(auction.auctionEnded, "Auction is still active");

        uint256 amount = auction.bids[msg.sender];
        require(amount > 0, "No funds to withdraw");

        auction.bids[msg.sender] = 0; // Set to zero before transfer to prevent reentrancy
        payable(msg.sender).sendValue(amount);
    }

    // Fallback to reject unexpected Ether transfers
    receive() external payable {
        revert("Direct Ether transfers not allowed");
    }
}
