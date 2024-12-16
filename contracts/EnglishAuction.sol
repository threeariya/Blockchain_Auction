// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol"; // For metadata support
import "@openzeppelin/contracts/token/ERC721/IERC721.sol"; // For interaction with ERC721 tokens
import "@openzeppelin/contracts/utils/Address.sol";

contract EnglishAuction is ERC721URIStorage, Ownable {
    using Address for address payable;

    struct Auction {
        uint256 auctionId;
        address highestBidder;
        uint256 highestBid;
        uint256 auctionEndTime;
        bool auctionEnded;
        uint256 minBidIncrement;
        address creator;
        bool withdrawn; // Track if funds have been withdrawn
        uint256 tokenId; // NFT being auctioned
        address nftContract; // Address of the NFT contract (ERC-721)
    }

    mapping(uint256 => Auction) public auctions; // Store auctions by ID
    uint256[] public auctionIds; // Array to store auction IDs
    bool private locked = false; // Reentrancy guard

    event AuctionCreated(uint256 auctionId, uint256 duration, uint256 minBidIncrement, uint256 startingPrice, address creator, uint256 tokenId, address nftContract);
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
        require(block.timestamp < auctions[auctionId].auctionEndTime, "Auction has expired");
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

    // Constructor that takes name and symbol for ERC721
    constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol) Ownable(msg.sender) {}

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

    // Create the auction and specify the NFT being auctioned
    function createAuction(
        uint256 auctionId,
        address nftContract,
        uint256 tokenId,
        uint256 _duration,
        uint256 _minBidIncrement,
        uint256 _startingPrice
    ) external {
        emit DebugCreateAuction(auctionId, _duration, _minBidIncrement, _startingPrice, nftContract, tokenId, msg.sender);
        require(auctions[auctionId].auctionEndTime == 0, "Auction already exists");
        require(_duration > 0, "Duration must be greater than zero");
        require(IERC721(nftContract).ownerOf(tokenId) == msg.sender, "Not the NFT owner");

        emit DebugNFTTransfer(msg.sender, address(this), tokenId);
        // Ensure the creator owns the token and it's an ERC-721 token
        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);

        auctions[auctionId] = Auction({
            auctionId: auctionId,
            highestBidder: address(0),
            highestBid: _startingPrice,
            auctionEndTime: block.timestamp + _duration,
            auctionEnded: false,
            minBidIncrement: _minBidIncrement,
            creator: msg.sender,
            withdrawn: false,
            tokenId: tokenId,
            nftContract: nftContract
        });

        auctionIds.push(auctionId);
        emit AuctionCreated(auctionId, _duration, _minBidIncrement, _startingPrice, msg.sender, tokenId, nftContract);
    }

    // Place a bid on the auction
    function placeBid(uint256 auctionId) external payable auctionActive(auctionId) nonReentrant {
        emit DebugLog("Entering placeBid function");
        Auction storage auction = auctions[auctionId];

        require(msg.sender != auction.creator, "Owner cannot bid on their own auction");
        require(msg.value >= auction.highestBid + auction.minBidIncrement, "Bid must be higher than current bid plus the minimum increment");
        require(msg.sender != auction.highestBidder, "You are already the highest bidder");
        emit DebugLog("Bid validation passed");

        if (auction.highestBid > 0) {
            // Refund the previous highest bidder
            payable(auction.highestBidder).sendValue(auction.highestBid);
            emit RefundIssued(auctionId, auction.highestBidder, auction.highestBid);
        }

        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;

        emit NewBidPlaced(auctionId, msg.sender, msg.value);
    }

    // End the auction and transfer the NFT to the highest bidder
    function endAuction(uint256 auctionId) external onlyAuctionCreator(auctionId) nonReentrant {
        emit DebugLog("Entering endAuction function");
        Auction storage auction = auctions[auctionId];
        require(block.timestamp >= auction.auctionEndTime, "Auction has not yet ended");
        require(!auction.auctionEnded, "Auction already ended");
        emit DebugLog("Auction ending conditions passed");

        auction.auctionEnded = true;
        if (auction.highestBidder != address(0) && auction.highestBid > 0) {
            // Transfer the NFT to the highest bidder
            IERC721(auction.nftContract).safeTransferFrom(address(this), auction.highestBidder, auction.tokenId);
        }

        emit AuctionEnded(auctionId, auction.highestBidder, auction.highestBid);
    }

    // Withdraw the funds after the auction ends
    function withdraw(uint256 auctionId) external onlyAuctionCreator(auctionId) nonReentrant {
        Auction storage auction = auctions[auctionId];

        require(auction.auctionEnded, "Auction has not yet ended");
        require(!auction.withdrawn, "Funds already withdrawn");
        require(auction.highestBid > 0, "No funds to withdraw");

        uint256 amount = auction.highestBid;
        auction.highestBid = 0;
        auction.withdrawn = true;

        payable(auction.creator).sendValue(amount);
        emit FundsWithdrawn(auctionId, amount, auction.creator);
    }

    // Get the list of all auction IDs
    function getAuctionIds() external view returns (uint256[] memory) {
        return auctionIds;
    }

    // Get the details of a specific auction
    function getAuctionDetails(uint256 auctionId)
        external
        view
        auctionExists(auctionId)
        returns (
            uint256 id,
            address highestBidder,
            uint256 highestBid,
            uint256 auctionEndTime,
            bool auctionEnded,
            uint256 minBidIncrement,
            address creator,
            bool withdrawn,
            uint256 tokenId,
            address nftContract
        )
    {
        Auction memory auction = auctions[auctionId];
        return (
            auction.auctionId,
            auction.highestBidder,
            auction.highestBid,
            auction.auctionEndTime,
            auction.auctionEnded,
            auction.minBidIncrement,
            auction.creator,
            auction.withdrawn,
            auction.tokenId,
            auction.nftContract
        );
    }

    // Optional: To set the URI for a specific NFT if using ERC721URIStorage (metadata)
    function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal virtual override {
        super._setTokenURI(tokenId, _tokenURI);
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
