// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract SecondPriceAuction {
    using Address for address payable;

    struct Auction {
        uint256 auctionEndTime;
        bool auctionEnded;
        address creator;
        uint256 highestBid; // Placeholder to determine the second-highest bid
        uint256 secondHighestBid; // Keeps track of the second-highest bid
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
    function createAuction(uint256 auctionId, uint256 _duration) external {
        require(auctions[auctionId].auctionEndTime == 0, "Auction already exists");
        
        // Initialize the auction fields individually
        Auction storage auction = auctions[auctionId];
        auction.auctionEndTime = block.timestamp + _duration;
        auction.auctionEnded = false;
        auction.creator = msg.sender;
        auction.highestBid = 0;
        auction.secondHighestBid = 0;
        auction.highestBidder = address(0);

        emit AuctionCreated(auctionId, _duration, msg.sender);
    }

    // Submit a bid (sealed bid process)
    function submitBid(uint256 auctionId) external payable auctionActive(auctionId) nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(msg.value > 0, "Bid value must be greater than zero");

        auction.bids[msg.sender] += msg.value;

        if (auction.bids[msg.sender] > auction.highestBid) {
            // Update second-highest bid before changing highest
            auction.secondHighestBid = auction.highestBid;
            auction.highestBid = auction.bids[msg.sender];
            auction.highestBidder = msg.sender;
        } else if (auction.bids[msg.sender] > auction.secondHighestBid) {
            // Update second-highest bid if higher than current second-highest
            auction.secondHighestBid = auction.bids[msg.sender];
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
