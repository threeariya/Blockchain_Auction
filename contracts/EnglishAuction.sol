// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract EnglishAuction {
    using Address for address payable;

    struct Auction {
        uint256 auctionId;
        address highestBidder;
        uint256 highestBid;
        uint256 auctionEndTime;
        bool auctionEnded;
        uint256 minBidIncrement;
        address creator;
        bool withdrawn;
        uint256 startingPrice;
        address nftContract;
        uint256 tokenId;
    }

    mapping(uint256 => Auction) public auctions;
    uint256[] public auctionIds;
    bool private locked = false;

    uint256 public constant MAX_DURATION = 100000; // Example maximum block duration

    event AuctionCreated(uint256 auctionId, uint256 duration, uint256 minBidIncrement, uint256 startingPrice, address creator);
    event NewBidPlaced(uint256 auctionId, address indexed bidder, uint256 amount);
    event RefundIssued(uint256 auctionId, address indexed bidder, uint256 amount);
    event AuctionEnded(uint256 auctionId, address winner, uint256 amount);
    event FundsWithdrawn(uint256 auctionId, uint256 amount, address indexed creator);
    event DebugLog(string message);
    event DebugAuction(uint256 auctionId, uint256 duration, uint256 minBidIncrement, uint256 startingPrice, address nftContract, uint256 tokenId, address creator);

    modifier nonReentrant() {
        require(!locked, "Reentrant call detected");
        locked = true;
        _;
        locked = false;
    }

    modifier auctionActive(uint256 auctionId) {
        require(auctions[auctionId].auctionEndTime > 0, "Auction does not exist");
        require(block.number < auctions[auctionId].auctionEndTime, "Auction has expired");
        require(!auctions[auctionId].auctionEnded, "Auction has already ended");
        _;
    }

    modifier auctionExists(uint256 auctionId) {
        require(auctions[auctionId].auctionEndTime > 0, "Auction does not exist");
        _;
    }

    modifier onlyAuctionCreator(uint256 auctionId) {
        require(msg.sender == auctions[auctionId].creator, "Only the auction creator can perform this action");
        _;
    }

    event DebugCreateAuction(
    uint256 auctionId,
    uint256 duration,
    uint256 minBidIncrement,
    uint256 startingPrice,
    address nftContract,
    uint256 tokenId,
    address creator
);

event DebugNFTTransfer(address from, address to, uint256 tokenId);


    function createAuction(
        uint256 auctionId,
        uint256 _duration,
        uint256 _minBidIncrement,
        uint256 _startingPrice,
        address _nftContract,
        uint256 _tokenId
    ) external {
        emit DebugCreateAuction(auctionId, _duration, _minBidIncrement, _startingPrice, _nftContract, _tokenId, msg.sender);

        require(auctions[auctionId].auctionEndTime == 0, "Auction already exists");
        require(_duration > 0 && _duration <= MAX_DURATION, "Invalid auction duration");
        require(_minBidIncrement > 0, "Minimum bid increment must be greater than zero");
        require(_startingPrice > 0, "Starting price must be greater than zero");

        require(
            IERC721(_nftContract).supportsInterface(type(IERC721).interfaceId),
            "Provided contract does not support ERC-721"
        );

        emit DebugNFTTransfer(msg.sender, address(this), _tokenId);

        IERC721(_nftContract).safeTransferFrom(msg.sender, address(this), _tokenId);

        uint256 auctionEndBlock = block.number + _duration;

        auctions[auctionId] = Auction({
            auctionId: auctionId,
            highestBidder: address(0),
            highestBid: _startingPrice,
            auctionEndTime: auctionEndBlock,
            auctionEnded: false,
            minBidIncrement: _minBidIncrement,
            creator: msg.sender,
            withdrawn: false,
            startingPrice: _startingPrice,
            nftContract: _nftContract,
            tokenId: _tokenId
        });

        auctionIds.push(auctionId);
        emit AuctionCreated(auctionId, _duration, _minBidIncrement, _startingPrice, msg.sender);
    }

    function placeBid(uint256 auctionId) external payable auctionActive(auctionId) nonReentrant {
        emit DebugLog("Entering placeBid function");
        Auction storage auction = auctions[auctionId];

        require(msg.sender != auction.creator, "Owner cannot bid on their own auction");
        require(msg.value >= auction.highestBid + auction.minBidIncrement, "Bid must be higher than the current bid plus the minimum increment");
        require(msg.sender != auction.highestBidder, "You are already the highest bidder");
        emit DebugLog("Bid validation passed");

        if (auction.highestBid > auction.startingPrice) {
            payable(auction.highestBidder).sendValue(auction.highestBid);
            emit RefundIssued(auctionId, auction.highestBidder, auction.highestBid);
        }

        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;

        emit NewBidPlaced(auctionId, msg.sender, msg.value);
    }

    function endAuction(uint256 auctionId) external onlyAuctionCreator(auctionId) nonReentrant {
        emit DebugLog("Entering endAuction function");
        Auction storage auction = auctions[auctionId];

        require(block.number >= auction.auctionEndTime, "Auction has not yet ended");
        require(!auction.auctionEnded, "Auction already ended");
        emit DebugLog("Auction ending conditions passed");

        auction.auctionEnded = true;
        emit AuctionEnded(auctionId, auction.highestBidder, auction.highestBid);
    }

    function getAuctionIds() external view returns (uint256[] memory) {
    return auctionIds;
    }

    function withdraw(uint256 auctionId) external onlyAuctionCreator(auctionId) nonReentrant {
        emit DebugLog("Entering withdraw function");
        Auction storage auction = auctions[auctionId];

        require(auction.auctionEnded, "Auction has not yet ended");
        require(!auction.withdrawn, "Funds already withdrawn");
        require(auction.highestBid > auction.startingPrice, "No funds to withdraw");
        emit DebugLog("Withdraw validation passed");

        uint256 amount = auction.highestBid;
        auction.highestBid = 0; // Reset before external call
        auction.withdrawn = true;

        payable(auction.creator).sendValue(amount);
        emit DebugLog("Funds withdrawn successfully");

        IERC721(auction.nftContract).safeTransferFrom(
            address(this),
            auction.highestBidder,
            auction.tokenId
        );
        emit DebugLog("NFT transferred to highest bidder");

        emit FundsWithdrawn(auctionId, amount, auction.creator);
    }

    function onERC721Received(
    address, /*operator*/
    address, /*from*/
    uint256, /*tokenId*/
    bytes calldata /*data*/
) external pure returns (bytes4) {
    return this.onERC721Received.selector;
    }
}