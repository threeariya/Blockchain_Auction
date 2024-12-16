// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ERC721Mock is ERC721, Ownable {
    uint256 private _nextTokenId;

    event TokenMinted(address indexed to, uint256 tokenId);

    constructor(string memory name, string memory symbol) ERC721(name, symbol) Ownable(msg.sender) {}

   function mint(address to, uint256 tokenId) public onlyOwner {
        _mint(to, tokenId);
        emit TokenMinted(to, tokenId); // Emit event
    }

    function mintNext(address to) public onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;
        _mint(to, tokenId);
        emit TokenMinted(to, tokenId); // Emit event
        return tokenId;
    }
}