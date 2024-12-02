// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract EnglishAuction is Ownable {
    using Address for address payable;

    address public highestBidder;
    uint256 public highestBid;
    bool public auctionEnded;
    uint256 public immutable auctionEndTime;
    uint256 public immutable minBidIncrement;

    bool private locked; // Custom reentrancy guard

    event NewBidPlaced(address indexed bidder, uint256 amount);
    event AuctionEnded(address winner, uint256 amount);

    constructor(uint256 _duration, uint256 _minBidIncrement) Ownable(msg.sender) {
        auctionEnded = false;
        highestBid = 0;
        auctionEndTime = block.timestamp + _duration;
        minBidIncrement = _minBidIncrement;
    }

    modifier auctionActive() {
        require(!auctionEnded, "Auction has ended");
        require(block.timestamp < auctionEndTime, "Auction has expired");
        _;
    }

    modifier nonReentrant() {
        require(!locked, "Reentrant call detected");
        locked = true;
        _;
        locked = false;
    }

    function placeBid() external payable auctionActive nonReentrant {
        require(msg.value > highestBid + minBidIncrement, "Bid must be higher than current bid plus the minimum increment");

        if (highestBid > 0) {
            payable(highestBidder).sendValue(highestBid);
        }

        highestBidder = msg.sender;
        highestBid = msg.value;

        emit NewBidPlaced(msg.sender, msg.value);
    }

    function withdrawBid() external nonReentrant {
        require(msg.sender == highestBidder, "Only the highest bidder can withdraw");
        require(block.timestamp < auctionEndTime, "Auction has ended, cannot withdraw");

        uint256 amount = highestBid;
        highestBid = 0;
        highestBidder = address(0);

        payable(msg.sender).sendValue(amount);

        emit NewBidPlaced(msg.sender, 0);
    }

    function endAuction() external onlyOwner nonReentrant {
        require(block.timestamp >= auctionEndTime, "Auction has not yet ended");
        require(!auctionEnded, "Auction already ended");

        auctionEnded = true;

        payable(owner()).sendValue(highestBid);

        emit AuctionEnded(highestBidder, highestBid);
    }
}
