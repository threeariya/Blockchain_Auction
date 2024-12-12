// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract EnglishAuction {
    using Address for address payable;

    struct Auction {
        address highestBidder;
        uint256 highestBid;
        uint256 auctionEndTime;
        bool auctionEnded;
        uint256 minBidIncrement;
        address creator; // The address that created the auction
    }

    mapping(uint256 => Auction) public auctions; // Mapping to track auctions by ID
    bool private locked = false; // Custom reentrancy guard

    event AuctionCreated(uint256 auctionId, uint256 duration, uint256 minBidIncrement, address creator);
    event NewBidPlaced(uint256 auctionId, address indexed bidder, uint256 amount);
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

    // Create a new auction
    function createAuction(
        uint256 auctionId,
        uint256 _duration,
        uint256 _minBidIncrement
    ) external {
        require(auctions[auctionId].auctionEndTime == 0, "Auction already exists");
        auctions[auctionId] = Auction({
            highestBidder: address(0),
            highestBid: 0,
            auctionEndTime: block.timestamp + _duration,
            auctionEnded: false,
            minBidIncrement: _minBidIncrement,
            creator: msg.sender // Set the auction creator as the sender
        });

        emit AuctionCreated(auctionId, _duration, _minBidIncrement, msg.sender);
    }

    // Place a bid on a specific auction
    function placeBid(uint256 auctionId) external payable auctionActive(auctionId) nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(
            msg.value > auction.highestBid + auction.minBidIncrement,
            "Bid must be higher than current bid plus the minimum increment"
        );
        require(msg.sender != auction.highestBidder, "You are already the highest bidder");

        // Refund the previous highest bidder if necessary
        if (auction.highestBid > 0) {
            payable(auction.highestBidder).sendValue(auction.highestBid);
        }

        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;

        emit NewBidPlaced(auctionId, msg.sender, msg.value);
    }

    // End the auction and transfer the highest bid to the auction creator
    function endAuction(uint256 auctionId) external onlyAuctionCreator(auctionId) nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(block.timestamp >= auction.auctionEndTime, "Auction has not yet ended");
        require(!auction.auctionEnded, "Auction already ended");

        auction.auctionEnded = true;

        // Transfer the highest bid to the auction creator
        payable(auction.creator).sendValue(auction.highestBid);

        emit AuctionEnded(auctionId, auction.highestBidder, auction.highestBid);
    }

    // Fallback function to handle unexpected Ether sent directly to the contract
    receive() external payable {
        revert("Direct Ether transfers not allowed");
    }
}
